const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');
const crypto = require('crypto');

const ENABLE_LOGGING = process.env.PRIME_VERBOSE === 'true' || process.env.PRIME_VERBOSE === '1';

const primeLog = [];
const primeCommitLog = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function logPrimeEvent(event) {
  primeLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node || '-', "-", event.phase || '-', "-", event.action || '-', event.details ? JSON.stringify(event.details) : "");
  }
}

const PrimeState = {
  view: 0,
  sequence: 0,
  nextExecuteSeq: 1,
  f: 1,
  log: {},
  pendingRequests: [],
  executedRequests: new Set()
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest', messageCount = 0;

function setNodeContext(nodeID) {
  // Load Byzantine configuration
  try {
    const byzantineConfig = require('./byzantine-config.js');
    myBehavior = byzantineConfig[nodeID] || 'honest';
    if (ENABLE_LOGGING) console.log(`Node ${nodeID} behavior: ${myBehavior}`);
  } catch (error) {
    myBehavior = 'honest';
  }
  
  myNodeID = nodeID;
  myPrivateKey = cryptoHelper.loadPrivateKey(nodeID);
  myPublicKey = cryptoHelper.loadPublicKey(nodeID);
  PrimeState.f = Math.floor((nodeIDs.length - 1) / 3);
  
  logPrimeEvent({ node: myNodeID, phase: 'INIT', action: 'Node context set' });
  
  // Reactive / periodic leader check
  setInterval(() => {
    if (myNodeID === getLeader(PrimeState.view) && PrimeState.pendingRequests.length > 0) {
      processRequests();
    }
  }, 10);

  setInterval(() => {
    executeInOrder();
  }, 10);
}

function getLeader(view) {
  return nodeIDs[view % nodeIDs.length];
}

function handleClientRequest(request, nodeID) {
  PrimeState.pendingRequests.push({ ...request, submitTime: Date.now() });
  logPrimeEvent({ node: nodeID, phase: 'CLIENT', action: 'Request received', details: request });
  if (myNodeID === getLeader(PrimeState.view)) {
    processRequests();
  }
}

const MAX_IN_FLIGHT = 10;

function processRequests() {
  if (PrimeState.pendingRequests.length === 0) return;
  
  const inFlight = Math.max(0, PrimeState.sequence - PrimeState.nextExecuteSeq + 1);
  if (inFlight >= MAX_IN_FLIGHT) return;
  
  const availableSlots = Math.max(1, MAX_IN_FLIGHT - inFlight);
  const batchSize = Math.min(availableSlots, PrimeState.pendingRequests.length);
  
  for (let i = 0; i < batchSize; i++) {
    const request = PrimeState.pendingRequests.shift();
    if (!request) break;
    
    PrimeState.sequence += 1;
    const seq = PrimeState.sequence;
    
    PrimeState.log[seq] = PrimeState.log[seq] || {
      request: null,
      preprepare: null,
      prepares: new Set(),
      commits: new Set(),
      executed: false,
      prepared: false,
      committed: false,
      view: PrimeState.view
    };
    
    PrimeState.log[seq].request = request;
    PrimeState.log[seq].submitTime = request.submitTime;
    PrimeState.log[seq].prepares.add(myNodeID);
    
    const prePrepareMsg = { view: PrimeState.view, seq, request };
    PrimeState.log[seq].preprepare = prePrepareMsg;
    
    broadcastMessage('PRE-PREPARE', prePrepareMsg);
    logPrimeEvent({ node: myNodeID, phase: 'PRE-PREPARE', action: `Sent pre-prepare for seq ${seq}` });
  }
}

function handlePrimeMessage(msg, nodeID) {
  const { type, sender, data, signature } = msg;
  messageCount++;
  
  // Apply Byzantine behavior
  if (myBehavior === 'silent' && messageCount > 3) {
    logPrimeEvent({node: myNodeID, phase: "BYZANTINE", action: `Silent node ignoring message #${messageCount}`});
    return;
  }
  
  if (myBehavior === 'delay') {
    const delay = Math.random() * 2000 + 1000;
    logPrimeEvent({node: myNodeID, phase: "BYZANTINE", action: `Delaying message by ${delay.toFixed(0)}ms`});
    setTimeout(() => processPrimeMessage(msg, nodeID), delay);
    return;
  }
  
  processPrimeMessage(msg, nodeID);
}

function processPrimeMessage(msg, nodeID) {
  const { type, sender, data } = msg;
  
  switch (type) {
    case 'PRE-PREPARE':
      onReceivePrePrepare(data, sender);
      break;
    case 'PREPARE':
      onReceivePrepare(data, sender);
      break;
    case 'COMMIT':
      onReceiveCommit(data, sender);
      break;
  }
}

function onReceivePrePrepare(data, sender) {
  const { view, seq, request } = data;
  if (view !== PrimeState.view) return;
  
  PrimeState.log[seq] = PrimeState.log[seq] || {
    request: null,
    preprepare: null,
    prepares: new Set(),
    commits: new Set(),
    executed: false,
    prepared: false,
    committed: false,
    view
  };
  
  PrimeState.log[seq].request = request;
  PrimeState.log[seq].preprepare = data;
  PrimeState.log[seq].prepares.add(myNodeID);
  PrimeState.log[seq].prepares.add(sender);
  
  // Send PREPARE vote directly to the Leader (Linear message pattern)
  const leaderID = getLeader(view);
  sendMessageToNode('PREPARE', leaderID, { view, seq });
  logPrimeEvent({ node: myNodeID, phase: 'PREPARE', action: `Sent prepare for seq ${seq} to Leader` });

  if (PrimeState.log[seq].committed) {
    executeInOrder();
  }
}

function onReceivePrepare(data, sender) {
  const { view, seq } = data;
  if (view !== PrimeState.view) return;
  
  PrimeState.log[seq] = PrimeState.log[seq] || {
    request: null,
    preprepare: null,
    prepares: new Set(),
    commits: new Set(),
    executed: false,
    prepared: false,
    committed: false,
    view
  };
  
  PrimeState.log[seq].prepares.add(sender);
  
  // Leader collects 2f prepares and broadcasts COMMIT to all nodes
  const leaderID = getLeader(view);
  if (myNodeID === leaderID && PrimeState.log[seq].prepares.size >= 2 * PrimeState.f && !PrimeState.log[seq].prepared && PrimeState.log[seq].request) {
    PrimeState.log[seq].prepared = true;
    PrimeState.log[seq].committed = true;
    
    const commitMsg = {
      view,
      seq,
      request: PrimeState.log[seq].request
    };
    broadcastMessage('COMMIT', commitMsg);
    logPrimeEvent({ node: myNodeID, phase: 'COMMIT', action: `Leader sent commit for seq ${seq}` });
    executeInOrder();
  }
}

function onReceiveCommit(data, sender) {
  const { view, seq, request } = data;
  if (view !== PrimeState.view) return;
  
  PrimeState.log[seq] = PrimeState.log[seq] || {
    request: null,
    preprepare: null,
    prepares: new Set(),
    commits: new Set(),
    executed: false,
    prepared: false,
    committed: false,
    view
  };
  
  if (request) {
    PrimeState.log[seq].request = request;
  }
  PrimeState.log[seq].committed = true;
  logPrimeEvent({ node: myNodeID, phase: 'COMMIT', action: `Received commit for seq ${seq}` });
  executeInOrder();
}

function executeInOrder() {
  while (PrimeState.log[PrimeState.nextExecuteSeq] && 
         PrimeState.log[PrimeState.nextExecuteSeq].committed && 
         PrimeState.log[PrimeState.nextExecuteSeq].request && 
         !PrimeState.log[PrimeState.nextExecuteSeq].executed) {
    
    const seq = PrimeState.nextExecuteSeq;
    const entry = PrimeState.log[seq];
    entry.executed = true;
    const request = entry.request;
    
    if (request && !PrimeState.executedRequests.has(request.id)) {
      PrimeState.executedRequests.add(request.id);
      
      // Apply Byzantine behavior to commit log
      let commitValue = request.value || 0;
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
        logPrimeEvent({node: myNodeID, phase: "CORRUPT", action: `Corrupted value ${request.value} -> ${commitValue}`});
      }
      
      primeCommitLog.push({
        committedAt: new Date().toISOString(),
        operation: request.operation || 'TX',
        value: commitValue,
        sequence: seq,
        totalTimeMs: entry.submitTime ? (Date.now() - entry.submitTime) : (request.submitTime ? (Date.now() - request.submitTime) : null)
      });
      
      logPrimeEvent({ node: myNodeID, phase: 'EXECUTION', action: `Executed request seq ${seq} with value ${commitValue}` });
    }
    
    PrimeState.nextExecuteSeq++;
    if (myNodeID === getLeader(PrimeState.view)) {
      setImmediate(processRequests);
    }
  }
}

function signMessage(msgObj) {
  const msgString = JSON.stringify(msgObj);
  return cryptoHelper.signMessage(myPrivateKey, msgString);
}

function sendMessageToNode(type, targetNodeID, data) {
  const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === targetNodeID);
  if (!targetNode) return;
  
  const nodeInfo = Object.values(targetNode)[0];
  const msgObj = { type, sender: myNodeID, data };
  msgObj.signature = signMessage(msgObj);
  broadcastNew.sendPostRequestsToIPs(msgObj, [nodeInfo.ip], [nodeInfo.port], ['api/prime'], myNodeID);
}

function broadcastMessage(type, data) {
  const allNodes = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
  const myIdx = allNodes.indexOf(myNodeID);
  const restNodes = graph.nodeIPsArray.map((obj, idx) => idx !== myIdx ? Object.values(obj)[0] : null).filter(Boolean);
  const ips = restNodes.map(n => n.ip);
  const ports = restNodes.map(n => n.port);
  const endpoints = ports.map(() => 'api/prime');
  const msgObj = { type, sender: myNodeID, data };
  msgObj.signature = signMessage(msgObj);
  broadcastNew.sendPostRequestsToIPs(msgObj, ips, ports, endpoints, myNodeID);
}

function getPrimeNodeLog() {
  return primeLog;
}

function getPrimeCommitLog() {
  return primeCommitLog;
}

module.exports = {
  setNodeContext,
  handleClientRequest,
  handlePrimeMessage,
  getPrimeNodeLog,
  getPrimeCommitLog
};