const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');
const crypto = require('crypto');

const ENABLE_LOGGING = process.env.HOTSTUFF_VERBOSE === 'true' || process.env.HOTSTUFF_VERBOSE === '1';
const NEXT_VIEW_TIMEOUT = 5000;

const hotstuffLog = [];
const hotstuffCommitLog = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function digestMessage(message) {
  return crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex');
}

function logHotStuffEvent(event) {
  hotstuffLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

function logPhase(nodeID, phase, block, extra = {}) {
  logHotStuffEvent({
    node: nodeID,
    phase,
    action: `Block ${block ? block.height : '-'}`,
    details: { blockId: block ? digestMessage(block) : '-', ...extra }
  });
}

const HotStuffState = {
  view: 0,
  height: 0,
  nextExecuteHeight: 1,
  lastExecutedHeight: 0,
  f: 1,
  tree: {},
  decidedBlocks: {},
  qcHigh: null,
  bLeaf: null,
  bLock: null,
  bExec: null,
  lockedQC: null,
  pendingRequests: [],
  pendingVotes: {},
  viewChangeTimer: null,
  executedRequests: new Set()
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest', messageCount = 0;

function setNodeContext(nodeID) {
  myNodeID = nodeID;
  myPrivateKey = cryptoHelper.loadPrivateKey(nodeID);
  myPublicKey = cryptoHelper.loadPublicKey(nodeID);
  
  // Load Byzantine configuration
  try {
    const byzantineConfig = require('./byzantine-config.js');
    myBehavior = byzantineConfig[nodeID] || 'honest';
    logHotStuffEvent({node: myNodeID, phase: "INIT", action: `Byzantine behavior: ${myBehavior}`});
  } catch (error) {
    myBehavior = 'honest';
  }
  HotStuffState.f = Math.floor((nodeIDs.length - 1) / 3);

  const genesisBlock = {
    parent: null,
    height: 0,
    view: 0,
    proposer: getLeader(0),
    command: null,
    justify: null
  };
  const genesisBlockId = digestMessage(genesisBlock);
  HotStuffState.tree[genesisBlockId] = genesisBlock;

  const genesisQC = { viewNumber: 0, blockId: genesisBlockId, signatures: new Set() };
  HotStuffState.qcHigh = genesisQC;
  HotStuffState.bLeaf = genesisBlockId;
  HotStuffState.bLock = genesisBlockId;
  HotStuffState.bExec = genesisBlockId;

  // Periodic triggers for leader and sequential execution
  setInterval(() => {
    if (myNodeID === getLeader(HotStuffState.view) && HotStuffState.pendingRequests.length > 0) {
      onBeat();
    }
  }, 10);
  
  setInterval(() => {
    executeInOrder();
  }, 10);
  
  logHotStuffEvent({node: myNodeID, phase: "INIT", action: `Node initialized, f=${HotStuffState.f}`});
}

function signMessage(msgObj) {
  const msgString = JSON.stringify(msgObj);
  return cryptoHelper.signMessage(myPrivateKey, msgString);
}

function verifySignature(sender, msgObj, signature) {
  try {
    const pubKey = cryptoHelper.loadPublicKey(sender);
    const msgString = JSON.stringify(msgObj);
    return cryptoHelper.verifySignature(pubKey, msgString, signature);
  } catch (e) {
    return false;
  }
}

function getLeader(view) {
  return nodeIDs[view % nodeIDs.length];
}

function startViewChangeTimer() {
  clearTimeout(HotStuffState.viewChangeTimer);
  HotStuffState.viewChangeTimer = setTimeout(() => {
    logHotStuffEvent({
      node: myNodeID,
      phase: "VIEW-CHANGE",
      action: `Leader suspected faulty. Initiating view change.`
    });
    onNewView();
  }, NEXT_VIEW_TIMEOUT);
}

const MAX_IN_FLIGHT = 10;

function onBeat() {
  if (myNodeID === getLeader(HotStuffState.view) && HotStuffState.pendingRequests.length > 0) {
    const inFlight = Math.max(0, HotStuffState.height - HotStuffState.nextExecuteHeight + 1);
    if (inFlight < MAX_IN_FLIGHT) {
      const availableSlots = Math.max(1, MAX_IN_FLIGHT - inFlight);
      const batchSize = Math.min(availableSlots, HotStuffState.pendingRequests.length);
      
      for (let i = 0; i < batchSize; i++) {
        const cmd = HotStuffState.pendingRequests.shift();
        if (!cmd) break;
        createProposal(cmd);
      }
    }
  }
}

function createProposal(cmd) {
  HotStuffState.height += 1;
  const currentHeight = HotStuffState.height;
  
  const block = {
    parent: HotStuffState.bLeaf,
    height: currentHeight,
    view: HotStuffState.view,
    proposer: myNodeID,
    command: cmd,
    justify: HotStuffState.qcHigh
  };
  const blockId = digestMessage(block);
  HotStuffState.tree[blockId] = block;
  HotStuffState.bLeaf = blockId;

  // Leader self-votes on PREPARE
  if (!HotStuffState.pendingVotes[blockId]) HotStuffState.pendingVotes[blockId] = new Set();
  HotStuffState.pendingVotes[blockId].add(myNodeID);

  broadcastMessage('PREPARE', { block, blockId });
  logPhase(myNodeID, "PREPARE", block, { command: cmd });
}

function handleClientRequest(request, nodeID) {
  const requestWithTime = { ...request, submitTime: Date.now() };
  HotStuffState.pendingRequests.push(requestWithTime);

  logHotStuffEvent({
    node: nodeID,
    phase: "CLIENT",
    action: `Request received`,
    details: request
  });

  if (nodeID === getLeader(HotStuffState.view)) {
    onBeat();
  }
}

function handleHotStuffMessage(msg, nodeID) {
  const { type, sender, data, signature } = msg;
  messageCount++;
  
  // Apply Byzantine behavior
  if (myBehavior === 'silent' && messageCount > 3) {
    logHotStuffEvent({node: myNodeID, phase: "BYZANTINE", action: `Silent node ignoring message #${messageCount}`});
    return;
  }
  
  if (myBehavior === 'delay') {
    const delay = Math.random() * 2000 + 1000;
    logHotStuffEvent({node: myNodeID, phase: "BYZANTINE", action: `Delaying message by ${delay.toFixed(0)}ms`});
    setTimeout(() => processHotStuffMessage(msg, nodeID), delay);
    return;
  }
  
  processHotStuffMessage(msg, nodeID);
}

function processHotStuffMessage(msg, nodeID) {
  const { type, sender, data, signature } = msg;
  if (!verifySignature(sender, { type, sender, data }, signature)) return;
  
  switch (type) {
    case 'PREPARE': onReceivePrepare(data, sender); break;
    case 'PREPARE-VOTE': onReceivePrepareVote(data, sender); break;
    case 'PRE-COMMIT': onReceivePreCommit(data, sender); break;
    case 'PRE-COMMIT-VOTE': onReceivePreCommitVote(data, sender); break;
    case 'COMMIT': onReceiveCommit(data, sender); break;
    case 'COMMIT-VOTE': onReceiveCommitVote(data, sender); break;
    case 'DECIDE': onReceiveDecide(data, sender); break;
    case 'NEW-VIEW': onReceiveNewView(data, sender); break;
  }
}

function onReceivePrepare(msg, sender) {
  const { block, blockId } = msg;
  if (!block) return;
  HotStuffState.tree[blockId] = block;
  
  const vote = { viewNumber: HotStuffState.view, blockId, voter: myNodeID };
  sendMessageToNode('PREPARE-VOTE', { ...vote }, block.proposer);
  
  logHotStuffEvent({
    node: myNodeID,
    phase: "PREPARE-VOTE",
    action: `Sent prepare vote for block ${block.height}`
  });

  if (HotStuffState.decidedBlocks[block.height]) {
    executeInOrder();
  }
}

function onReceivePrepareVote(msg, sender) {
  collectVote('prepare', msg, onPrepareQCFormed);
}

function onPrepareQCFormed(blockId) {
  const block = HotStuffState.tree[blockId];
  if (!block) return;
  
  HotStuffState.qcHigh = { viewNumber: HotStuffState.view, blockId };
  
  // Fast Linear HotStuff: PrepareQC forms consensus -> Leader broadcasts DECIDE
  broadcastMessage('DECIDE', { block, blockId });
  HotStuffState.decidedBlocks[block.height] = block;
  executeInOrder();
  logPhase(myNodeID, "DECIDE", block, { executed: true, qc: blockId });
  clearTimeout(HotStuffState.viewChangeTimer);
  
  if (myNodeID === getLeader(HotStuffState.view)) {
    setImmediate(onBeat);
  }
}

function onReceivePreCommit(msg, sender) {
  const { block, blockId } = msg;
  if (!block) return;
  HotStuffState.tree[blockId] = block;
  
  const vote = { viewNumber: HotStuffState.view, blockId, voter: myNodeID };
  sendMessageToNode('PRE-COMMIT-VOTE', { ...vote }, block.proposer);
}

function onReceivePreCommitVote(msg, sender) {
  collectVote('precommit', msg, onPreCommitQCFormed);
}

function onPreCommitQCFormed(blockId) {
  const block = HotStuffState.tree[blockId];
  if (!block) return;
  
  HotStuffState.lockedQC = { blockId };
  broadcastMessage('COMMIT', { block, blockId });
}

function onReceiveCommit(msg, sender) {
  const { block, blockId } = msg;
  if (!block) return;
  HotStuffState.tree[blockId] = block;
  
  const vote = { viewNumber: HotStuffState.view, blockId, voter: myNodeID };
  sendMessageToNode('COMMIT-VOTE', { ...vote }, block.proposer);
}

function onReceiveCommitVote(msg, sender) {
  collectVote('commit', msg, onCommitQCFormed);
}

function onCommitQCFormed(blockId) {
  const block = HotStuffState.tree[blockId];
  if (!block) return;
  
  broadcastMessage('DECIDE', { block, blockId });
  HotStuffState.decidedBlocks[block.height] = block;
  executeInOrder();
  logPhase(myNodeID, "DECIDE", block, { executed: true });
  clearTimeout(HotStuffState.viewChangeTimer);
  
  if (myNodeID === getLeader(HotStuffState.view)) {
    setImmediate(onBeat);
  }
}

function onReceiveDecide(msg, sender) {
  const { block, blockId } = msg;
  if (!block) return;
  HotStuffState.tree[blockId] = block;
  HotStuffState.decidedBlocks[block.height] = block;
  executeInOrder();
  logPhase(myNodeID, "DECIDE", block, { executed: true });
  clearTimeout(HotStuffState.viewChangeTimer);
}

function collectVote(phase, vote, callback) {
  const { blockId, voter } = vote;
  if (!blockId) return;
  const voterId = voter || 'unknown';
  const voteKey = phase === 'prepare' ? blockId : `${phase}_${blockId}`;
  
  if (!HotStuffState.pendingVotes[voteKey]) HotStuffState.pendingVotes[voteKey] = new Set();
  HotStuffState.pendingVotes[voteKey].add(voterId);
  
  // Required quorum: 2f votes from replicas (+ leader self-vote = 2f+1)
  const threshold = 2 * HotStuffState.f;
  if (HotStuffState.pendingVotes[voteKey].size >= threshold) {
    callback(blockId);
  }
}

function executeInOrder() {
  while (HotStuffState.decidedBlocks[HotStuffState.nextExecuteHeight]) {
    const height = HotStuffState.nextExecuteHeight;
    const block = HotStuffState.decidedBlocks[height];
    const cmd = block ? block.command : null;
    
    if (cmd && !HotStuffState.executedRequests.has(cmd.id)) {
      HotStuffState.executedRequests.add(cmd.id);
      
      let commitValue = cmd.value || 0;
      if (myBehavior === 'corrupt') {
        const corruptionTypes = ['add', 'multiply', 'random'];
        const corruptionType = corruptionTypes[Math.floor(Math.random() * corruptionTypes.length)];
        
        switch (corruptionType) {
          case 'add':
            commitValue = commitValue + Math.floor(Math.random() * 100) + 1;
            break;
          case 'multiply':
            commitValue = commitValue * (Math.floor(Math.random() * 3) + 2);
            break;
          case 'random':
            commitValue = Math.floor(Math.random() * 1000) + 1;
            break;
        }
        logHotStuffEvent({node: myNodeID, phase: "CORRUPT", action: `Corrupted value ${cmd.value} -> ${commitValue}`});
      }
      
      hotstuffCommitLog.push({
        committedAt: new Date().toISOString(),
        operation: cmd.operation || 'TX',
        value: commitValue,
        height: height,
        totalTimeMs: cmd.submitTime ? (Date.now() - cmd.submitTime) : null
      });
      
      HotStuffState.lastExecutedHeight = height;
      logHotStuffEvent({node: myNodeID, phase: "EXECUTION", action: `Executed block #${height} in order ✅`});
    }
    
    HotStuffState.nextExecuteHeight++;
    if (myNodeID === getLeader(HotStuffState.view)) {
      setImmediate(onBeat);
    }
  }
}

function onNewView() {
  HotStuffState.view++;
  logHotStuffEvent({
    node: myNodeID,
    phase: "NEW-VIEW",
    action: `Advanced to view ${HotStuffState.view}`
  });
}

function onReceiveNewView(msg, sender) {
  if (msg.view > HotStuffState.view) {
    HotStuffState.view = msg.view;
    logHotStuffEvent({
      node: myNodeID,
      phase: "NEW-VIEW",
      action: `Updated to view ${HotStuffState.view} from ${sender}`
    });
  }
}

function broadcastMessage(type, data) {
  const allNodes = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
  const myIdx = allNodes.indexOf(myNodeID);
  const restNodes = graph.nodeIPsArray.map((obj, idx) => idx !== myIdx ? Object.values(obj)[0] : null).filter(Boolean);

  const ips = restNodes.map(n => n.ip);
  const ports = restNodes.map(n => n.port);
  const endpoints = ports.map(() => 'api/hotstuff');

  const msgObj = { type, sender: myNodeID, data };
  const signature = signMessage(msgObj);
  const signedMsg = { ...msgObj, signature };

  broadcastNew.sendPostRequestsToIPs(signedMsg, ips, ports, endpoints, myNodeID);
}

function sendMessageToNode(type, data, targetNodeID) {
  const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === targetNodeID);
  if (!targetNode) return;

  const nodeInfo = Object.values(targetNode)[0];
  const msgObj = { type, sender: myNodeID, data };
  const signature = signMessage(msgObj);
  const signedMsg = { ...msgObj, signature };

  broadcastNew.sendPostRequestsToIPs(signedMsg, [nodeInfo.ip], [nodeInfo.port], ['api/hotstuff'], myNodeID);
}

function getHotStuffNodeLog() {
  return hotstuffLog;
}

function getHotStuffCommitLog() {
  return hotstuffCommitLog;
}

module.exports = {
  setNodeContext,
  handleClientRequest,
  handleHotStuffMessage,
  getHotStuffNodeLog,
  getHotStuffCommitLog
};