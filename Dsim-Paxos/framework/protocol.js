const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');

const ENABLE_LOGGING = process.env.PAXOS_VERBOSE === 'true' || process.env.PAXOS_VERBOSE === '1';

const paxosLog = [];
const paxosCommitLog = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function logPaxosEvent(event) {
  paxosLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

const PaxosState = {
  sequence: 0,
  nextExecuteSeq: 1,
  instances: {},
  pendingRequests: [],
  executedRequests: new Set(),
  majority: 65
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
  
  PaxosState.majority = Math.floor(nodeIDs.length / 2) + 1;
  
  logPaxosEvent({node: myNodeID, phase: "INIT", action: `Node initialized, majority: ${PaxosState.majority}`});
  
  setInterval(() => {
    if (myNodeID === nodeIDs[0] && PaxosState.pendingRequests.length > 0) {
      processRequests();
    }
  }, 10);

  setInterval(() => {
    executeInOrder();
  }, 10);
}

function signPaxosMessage(msgObj) {
  const msgString = JSON.stringify(msgObj);
  return cryptoHelper.signMessage(myPrivateKey, msgString);
}

function verifyPaxosSignature(sender, msgObj, signature) {
  try {
    const pubKey = cryptoHelper.loadPublicKey(sender);
    const msgString = JSON.stringify(msgObj);
    return cryptoHelper.verifySignature(pubKey, msgString, signature);
  } catch(e) {
    return false;
  }
}

function handleClientRequest(request, myNodeID) {
  if (myBehavior === 'crash' && paxosCommitLog.length >= 4) {
    logPaxosEvent({node: myNodeID, phase: "CRASH", action: `Crash node rejecting client request after ${paxosCommitLog.length} commits`});
    return;
  }
  
  PaxosState.pendingRequests.push({ ...request, submitTime: Date.now() });
  logPaxosEvent({node: myNodeID, phase: "CLIENT", action: `Queued client request`, details: request});
  
  if (myNodeID === nodeIDs[0]) {
    processRequests();
  }
}

const MAX_IN_FLIGHT = 10;

function processRequests() {
  if (PaxosState.pendingRequests.length === 0) return;
  
  const inFlight = Math.max(0, PaxosState.sequence - PaxosState.nextExecuteSeq + 1);
  if (inFlight >= MAX_IN_FLIGHT) return;
  
  const availableSlots = Math.max(1, MAX_IN_FLIGHT - inFlight);
  const batchSize = Math.min(availableSlots, PaxosState.pendingRequests.length);
  
  for (let i = 0; i < batchSize; i++) {
    const request = PaxosState.pendingRequests.shift();
    if (!request) break;
    
    PaxosState.sequence += 1;
    const instanceSeq = PaxosState.sequence;
    const proposalNumber = Date.now();
    
    PaxosState.instances[instanceSeq] = PaxosState.instances[instanceSeq] || {
      instanceSeq,
      proposalNumber,
      value: request,
      accepted: new Set(),
      decided: false,
      executed: false,
      submitTime: request.submitTime
    };
    
    PaxosState.instances[instanceSeq].value = request;
    PaxosState.instances[instanceSeq].submitTime = request.submitTime;
    PaxosState.instances[instanceSeq].accepted.add(myNodeID);
    
    const acceptMsg = {
      instanceSeq,
      proposalNumber,
      value: request
    };
    
    broadcastPaxosMessage('ACCEPT', myNodeID, acceptMsg);
    logPaxosEvent({node: myNodeID, phase: "ACCEPT", action: `Broadcast ACCEPT for instance ${instanceSeq}`});
  }
}

function handlePaxosMessage(msg, myNodeID) {
  const { type, sender, data, signature } = msg;
  messageCount++;
  
  // Apply Byzantine behavior
  if (myBehavior === 'silent' && messageCount > 2) {
    logPaxosEvent({node: myNodeID, phase: "BYZANTINE", action: `Silent node ignoring message #${messageCount}`});
    return;
  }
  
  if (myBehavior === 'delay') {
    const delay = Math.random() * 2000 + 1000;
    logPaxosEvent({node: myNodeID, phase: "BYZANTINE", action: `Delaying message by ${delay.toFixed(0)}ms`});
    setTimeout(() => processPaxosMessage(msg, myNodeID), delay);
    return;
  }
  
  processPaxosMessage(msg, myNodeID);
}

function processPaxosMessage(msg, myNodeID) {
  const { type, sender, data, signature } = msg;

  const msgToVerify = {type, sender, data};
  if (!verifyPaxosSignature(sender, msgToVerify, signature)) {
    logPaxosEvent({node: myNodeID, phase: "SECURITY", action: `Invalid signature from ${sender}`});
    return;
  }
  
  // Apply crash behavior - stop processing after several transactions
  if (myBehavior === 'crash' && paxosCommitLog.length >= 4) {
    logPaxosEvent({node: myNodeID, phase: "CRASH", action: `Crash node stopping after ${paxosCommitLog.length} commits`});
    return;
  }

  const { instanceSeq, instanceId } = data;
  const seq = instanceSeq || instanceId;
  if (!seq) return;

  PaxosState.instances[seq] = PaxosState.instances[seq] || {
    instanceSeq: seq,
    proposalNumber: data.proposalNumber || 0,
    value: data.value,
    accepted: new Set(),
    decided: false,
    executed: false,
    submitTime: data.value?.submitTime || Date.now()
  };

  const inst = PaxosState.instances[seq];

  if (type === 'PREPARE') {
    const promiseMsg = {
      instanceSeq: seq,
      proposalNumber: data.proposalNumber,
      acceptedProposal: null,
      acceptedValue: null
    };
    sendPaxosMessage('PROMISE', myNodeID, sender, promiseMsg);
  }

  if (type === 'ACCEPT') {
    const { proposalNumber, value } = data;
    
    let acceptedValue = value;
    // Apply corrupt behavior
    if (myBehavior === 'corrupt' && Math.random() < 0.5) {
      acceptedValue = {...acceptedValue, value: Math.floor(Math.random() * 1000)};
    }
    
    inst.value = acceptedValue;
    inst.proposalNumber = proposalNumber;
    inst.accepted.add(myNodeID);
    inst.accepted.add(sender);
    
    const acceptedMsg = {
      instanceSeq: seq,
      proposalNumber,
      value: acceptedValue
    };
    
    // Send ACCEPTED vote back to proposer (sender)
    sendPaxosMessage('ACCEPTED', myNodeID, sender, acceptedMsg);
    
    inst.decided = true;
    executeInOrder();
  }

  if (type === 'ACCEPTED') {
    inst.accepted.add(sender);
    
    if (inst.accepted.size >= PaxosState.majority && !inst.decided) {
      inst.decided = true;
      executeInOrder();
    }
  }
}

function executeInOrder() {
  while (PaxosState.instances[PaxosState.nextExecuteSeq] && 
         PaxosState.instances[PaxosState.nextExecuteSeq].decided && 
         !PaxosState.instances[PaxosState.nextExecuteSeq].executed) {
    
    const seq = PaxosState.nextExecuteSeq;
    const inst = PaxosState.instances[seq];
    inst.executed = true;
    
    const val = inst.value;
    let commitValue = val?.value || 0;
    
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
    }
    
    paxosCommitLog.push({
      committedAt: new Date().toISOString(),
      instanceId: seq,
      operation: val?.operation || 'TX',
      value: commitValue,
      totalTimeMs: inst.submitTime ? (Date.now() - inst.submitTime) : null
    });
    
    logPaxosEvent({node: myNodeID, phase: "DECIDED", action: `Committed instance ${seq} = ${commitValue}`});
    
    PaxosState.nextExecuteSeq++;
    if (myNodeID === nodeIDs[0]) {
      setImmediate(processRequests);
    }
  }
}

function sendPaxosMessage(type, myNodeID, targetNodeID, data) {
  const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === targetNodeID);
  if (!targetNode) return;
  
  const nodeInfo = Object.values(targetNode)[0];
  const msgObj = { type, sender: myNodeID, data };
  const signature = signPaxosMessage(msgObj);
  const signedMsg = {...msgObj, signature};

  broadcastNew.sendPostRequestsToIPs(signedMsg, [nodeInfo.ip], [nodeInfo.port], ['api/paxos'], myNodeID);
}

function broadcastPaxosMessage(type, myNodeID, data) {
  const allNodes = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
  const myIdx = allNodes.indexOf(myNodeID);
  const restNodes = graph.nodeIPsArray.map((obj, idx) => idx !== myIdx ? Object.values(obj)[0] : null).filter(Boolean);

  const ips = restNodes.map(n => n.ip);
  const ports = restNodes.map(n => n.port);
  const endpoints = ports.map(() => 'api/paxos');

  const msgObj = { type, sender: myNodeID, data };
  const signature = signPaxosMessage(msgObj);
  const signedMsg = {...msgObj, signature};

  broadcastNew.sendPostRequestsToIPs(signedMsg, ips, ports, endpoints, myNodeID);
}

function getPaxosNodeLog() {
  return paxosLog;
}

function getPaxosCommitLog() {
  return paxosCommitLog;
}

module.exports = {
  setNodeContext,
  handleClientRequest,
  handlePaxosMessage,
  getPaxosNodeLog,
  getPaxosCommitLog
};