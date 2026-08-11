const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');
const crypto = require('crypto');

const ENABLE_LOGGING = true;
const NEXT_VIEW_TIMEOUT = 2000;
const PACEMAKER_INTERVAL = 100;

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
    action: `Block ${block.height}`,
    details: { blockId: digestMessage(block), ...extra }
  });
}

const HotStuffState = {
  view: 0,
  height: 0,
  f: 1,
  tree: {},
  qcHigh: null,
  bLeaf: null,
  bLock: null,
  bExec: null,
  lockedQC: null,
  pendingRequests: [],
  pendingVotes: {},
  viewChangeTimer: null,
  pacemakerTimer: null,
  clientRequestMap: {},
  lastExecutedHeight: 0,
  executedRequests: new Set(),
  processingTransaction: false
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

  startPacemakerTimer();
  
  // Timeout recovery for processing lock
  setInterval(() => {
    if (myNodeID === getLeader(HotStuffState.view) && HotStuffState.processingTransaction) {
      HotStuffState.processingTransaction = false;
      logHotStuffEvent({node: myNodeID, phase: "RECOVERY", action: "Unlocked processing due to timeout"});
    }
  }, 3000);
  
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

function startPacemakerTimer() {
  clearTimeout(HotStuffState.pacemakerTimer);
  HotStuffState.pacemakerTimer = setTimeout(() => {
    onBeat();
  }, PACEMAKER_INTERVAL);
}

function onBeat() {
  if (myNodeID === getLeader(HotStuffState.view) && HotStuffState.pendingRequests.length > 0) {
    // Allow up to 3 concurrent transactions
    const maxConcurrent = 3;
    const activeTransactions = Object.values(HotStuffState.tree).filter(block => 
      block && block.height > 0 && block.height > HotStuffState.lastExecutedHeight
    ).length;
    
    if (activeTransactions < maxConcurrent) {
      const cmd = HotStuffState.pendingRequests.shift();
      createProposal(cmd);
    }
  }
  startPacemakerTimer();
}

function createProposal(cmd) {
  const block = {
    parent: HotStuffState.bLeaf,
    height: HotStuffState.tree[HotStuffState.bLeaf].height + 1,
    view: HotStuffState.view,
    proposer: myNodeID,
    command: cmd,
    justify: HotStuffState.qcHigh
  };
  const blockId = digestMessage(block);
  HotStuffState.tree[blockId] = block;
  HotStuffState.bLeaf = blockId;

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
  
  // Apply corrupt behavior to voting
  if (myBehavior === 'corrupt' && Math.random() < 0.3) {
    logHotStuffEvent({node: myNodeID, phase: "BYZANTINE", action: `Corrupt node ignoring message type ${type}`});
    return;
  }
  
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
  if (!HotStuffState.tree[block.parent]) return;

  HotStuffState.tree[blockId] = block;
  const vote = { viewNumber: HotStuffState.view, blockId, voter: myNodeID };
  sendMessageToNode('PREPARE-VOTE', { ...vote }, block.proposer);
  
  logHotStuffEvent({
    node: myNodeID,
    phase: "PREPARE-VOTE",
    action: `Sent prepare vote for block ${block.height}`
  });
}

function onReceivePrepareVote(msg, sender) {
  collectVote('prepare', msg, onPrepareQCFormed);
}

function onPrepareQCFormed(blockId) {
  const block = HotStuffState.tree[blockId];
  broadcastMessage('PRE-COMMIT', { block, blockId });
  logPhase(myNodeID, "PRE-COMMIT", block, { qc: blockId });
}

function onReceivePreCommit(msg, sender) {
  const { block, blockId } = msg;
  HotStuffState.tree[blockId] = block;
  const vote = { viewNumber: HotStuffState.view, blockId, voter: myNodeID };
  sendMessageToNode('PRE-COMMIT-VOTE', { ...vote }, block.proposer);
  logHotStuffEvent({ node: myNodeID, phase: "PRE-COMMIT-VOTE", action: `Sent precommit vote for block ${block.height}` });
}

function onReceivePreCommitVote(msg, sender) {
  collectVote('precommit', msg, onPreCommitQCFormed);
}

function onPreCommitQCFormed(blockId) {
  const block = HotStuffState.tree[blockId];
  HotStuffState.lockedQC = { blockId, signatures: HotStuffState.pendingVotes[blockId] };
  broadcastMessage('COMMIT', { block, blockId });
  logPhase(myNodeID, "COMMIT", block, { qc: blockId });
}

function onReceiveCommit(msg, sender) {
  const { block, blockId } = msg;
  HotStuffState.tree[blockId] = block;
  const vote = { viewNumber: HotStuffState.view, blockId, voter: myNodeID };
  sendMessageToNode('COMMIT-VOTE', { ...vote }, block.proposer);
  logHotStuffEvent({ node: myNodeID, phase: "COMMIT-VOTE", action: `Sent commit vote for block ${block.height}` });
}

function onReceiveCommitVote(msg, sender) {
  collectVote('commit', msg, onCommitQCFormed);
}

function onCommitQCFormed(blockId) {
  const block = HotStuffState.tree[blockId];
  broadcastMessage('DECIDE', { block, blockId });
  executeBlocks(HotStuffState.bExec, blockId);
  HotStuffState.bExec = blockId;
  logPhase(myNodeID, "DECIDE", block, { executed: true });
  clearTimeout(HotStuffState.viewChangeTimer);
  
  // Allow next transaction to be processed
  if (myNodeID === getLeader(HotStuffState.view)) {
    HotStuffState.processingTransaction = false;
  }
}

function onReceiveDecide(msg, sender) {
  const { block, blockId } = msg;
  if (!HotStuffState.tree[blockId]) HotStuffState.tree[blockId] = block;

  executeBlocks(HotStuffState.bExec, blockId);
  HotStuffState.bExec = blockId;
  logPhase(myNodeID, "DECIDE", block, { executed: true });
  clearTimeout(HotStuffState.viewChangeTimer);
  
  // Allow next transaction to be processed
  if (myNodeID === getLeader(HotStuffState.view)) {
    HotStuffState.processingTransaction = false;
  }
}

function collectVote(type, vote, callback) {
  const { blockId, voter } = vote;
  if (!HotStuffState.pendingVotes[blockId]) HotStuffState.pendingVotes[blockId] = new Set();
  HotStuffState.pendingVotes[blockId].add(voter);
  
  // Byzantine fault tolerance: need 2f+1 votes (majority of all nodes)
  const threshold = 2 * HotStuffState.f + 1;
  if (HotStuffState.pendingVotes[blockId].size >= threshold) {
    callback(blockId);
    delete HotStuffState.pendingVotes[blockId];
  }
}

function executeBlocks(fromBlockId, toBlockId) {
  const path = getPathBetweenBlocks(fromBlockId, toBlockId);
  for (const blockId of path) {
    const block = HotStuffState.tree[blockId];
    if (block && block.command && block.height > HotStuffState.lastExecutedHeight) {
      // Prevent duplicate execution
      if (!HotStuffState.executedRequests.has(block.command.id)) {
        HotStuffState.executedRequests.add(block.command.id);
        
        // Apply corrupt behavior to final commit
        let commitValue = block.command.value || 0;
        if (myBehavior === 'corrupt') {
          // Randomly corrupt the value
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
          logHotStuffEvent({node: myNodeID, phase: "CORRUPT", action: `Corrupted value ${block.command.value} -> ${commitValue}`});
        }
        
        hotstuffCommitLog.push({
          committedAt: new Date().toISOString(),
          operation: block.command.operation || 'TX',
          value: commitValue,
          height: block.height,
          totalTimeMs: block.command.submitTime ? (Date.now() - block.command.submitTime) : null
        });
        HotStuffState.lastExecutedHeight = block.height;
      }
    }
  }
}

function getPathBetweenBlocks(fromBlockId, toBlockId) {
  const path = [];
  let currentBlockId = toBlockId;
  
  while (currentBlockId && currentBlockId !== fromBlockId) {
    path.unshift(currentBlockId);
    const block = HotStuffState.tree[currentBlockId];
    currentBlockId = block ? block.parent : null;
  }
  
  return path;
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
  // Simplified view change handling
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

  broadcastNew.sendPostRequestsToIPs(signedMsg, [nodeInfo.ip], [nodeInfo.port], ['api/hotstuff']);
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