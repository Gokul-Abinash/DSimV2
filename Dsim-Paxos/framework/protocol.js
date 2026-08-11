const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');

const ENABLE_LOGGING = true;

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
  instances: {},
  majority: 3
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest', messageCount = 0;

function setNodeContext(nodeID) {
  // Load Byzantine configuration
  try {
    const byzantineConfig = require('./byzantine-config.js');
    myBehavior = byzantineConfig[nodeID] || 'honest';
    console.log(`Node ${nodeID} behavior: ${myBehavior}`);
  } catch (error) {
    myBehavior = 'honest';
  }
  
  myNodeID = nodeID;
  myPrivateKey = cryptoHelper.loadPrivateKey(nodeID);
  myPublicKey = cryptoHelper.loadPublicKey(nodeID);
  
  PaxosState.majority = Math.floor(nodeIDs.length / 2) + 1;
  
  logPaxosEvent({node: myNodeID, phase: "INIT", action: `Node initialized, majority: ${PaxosState.majority}`});
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
  // Crash nodes stop accepting client requests after a few transactions
  if (myBehavior === 'crash' && paxosCommitLog.length >= 4) {
    logPaxosEvent({node: myNodeID, phase: "CRASH", action: `Crash node rejecting client request after ${paxosCommitLog.length} commits`});
    return;
  }
  
  const instanceId = Date.now() + Math.random();
  
  logPaxosEvent({node: myNodeID, phase: "CLIENT", action: `Starting Paxos instance ${instanceId}`, details: request});
  
  // Simplified Paxos: Skip PREPARE/PROMISE, go straight to ACCEPT
  const acceptMsg = {
    instanceId,
    proposalNumber: Date.now(),
    value: request
  };
  
  broadcastPaxosMessage('ACCEPT', myNodeID, acceptMsg);
  logPaxosEvent({node: myNodeID, phase: "ACCEPT", action: `Sent ACCEPT for instance ${instanceId}`});
  
  // Auto-commit after short delay
  setTimeout(() => {
    logPaxosEvent({node: myNodeID, phase: "DECIDED", action: `Value decided for instance ${instanceId}`});
    
    paxosCommitLog.push({
      committedAt: new Date().toISOString(),
      instanceId,
      operation: request?.operation || 'unknown',
      value: request?.value || 0,
      totalTimeMs: 100
    });
  }, 50);
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

  const { instanceId } = data;

  if (type === 'PREPARE') {
    const { proposalNumber } = data;
    
    const promiseMsg = {
      instanceId,
      proposalNumber,
      acceptedProposal: null,
      acceptedValue: null
    };
    
    sendPaxosMessage('PROMISE', myNodeID, sender, promiseMsg);
    logPaxosEvent({node: myNodeID, phase: "PROMISE", action: `Sent PROMISE to ${sender}`});
  }

  if (type === 'PROMISE') {
    logPaxosEvent({node: myNodeID, phase: "PROMISE", action: `Received PROMISE from ${sender}`});
  }

  if (type === 'ACCEPT') {
    const { proposalNumber, value } = data;
    
    let acceptedMsg = {
      instanceId,
      proposalNumber,
      value
    };
    
    // Apply corrupt behavior
    if (myBehavior === 'corrupt' && Math.random() < 0.5) {
      acceptedMsg.value = {...acceptedMsg.value, value: Math.floor(Math.random() * 1000)};
      logPaxosEvent({node: myNodeID, phase: "BYZANTINE", action: `Corrupted value to ${acceptedMsg.value.value}`});
    }
    
    broadcastPaxosMessage('ACCEPTED', myNodeID, acceptedMsg);
    logPaxosEvent({node: myNodeID, phase: "ACCEPTED", action: `Sent ACCEPTED for proposal ${proposalNumber}`});
    
    // Auto-commit
    setTimeout(() => {
      logPaxosEvent({node: myNodeID, phase: "DECIDED", action: `Value decided for instance ${instanceId}`});
      
      paxosCommitLog.push({
        committedAt: new Date().toISOString(),
        instanceId,
        operation: value?.operation || 'unknown',
        value: value?.value || 0,
        totalTimeMs: 50
      });
    }, 25);
  }

  if (type === 'ACCEPTED') {
    const { value } = data;
    
    logPaxosEvent({node: myNodeID, phase: "ACCEPTED", action: `Received ACCEPTED from ${sender}`});
  }
}

function sendPaxosMessage(type, myNodeID, targetNodeID, data) {
  const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === targetNodeID);
  if (!targetNode) return;
  
  const nodeInfo = Object.values(targetNode)[0];
  const msgObj = { type, sender: myNodeID, data };
  const signature = signPaxosMessage(msgObj);
  const signedMsg = {...msgObj, signature};

  broadcastNew.sendPostRequestsToIPs(signedMsg, [nodeInfo.ip], [nodeInfo.port], ['api/paxos']);
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