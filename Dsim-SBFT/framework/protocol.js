const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');
const crypto = require('crypto');

const ENABLE_LOGGING = true;

const sbftLog = [];
const sbftCommitLog = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function logSBFTEvent(event) {
  sbftLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

const SBFTState = {
  sequence: 0,
  f: 1,
  log: {},
  pendingRequests: [],
  executedRequests: new Set(),
  processingTransaction: false
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest', messageCount = 0;

function setNodeContext(nodeID) {
  myNodeID = nodeID;
  myPrivateKey = cryptoHelper.loadPrivateKey(nodeID);
  myPublicKey = cryptoHelper.loadPublicKey(nodeID);
  SBFTState.f = Math.floor((nodeIDs.length - 1) / 3);
  
  // Load Byzantine configuration
  try {
    const byzantineConfig = require('./byzantine-config.js');
    myBehavior = byzantineConfig[nodeID] || 'honest';
    logSBFTEvent({node: myNodeID, phase: "INIT", action: `Byzantine behavior: ${myBehavior}`});
  } catch (error) {
    myBehavior = 'honest';
  }
  
  const primary = nodeIDs[0];
  const collectors = [nodeIDs[1], nodeIDs[2]];
  
  let role = 'backup';
  if (nodeID === primary) role = 'primary';
  else if (collectors.includes(nodeID)) role = 'collector';
  
  logSBFTEvent({node: myNodeID, phase: "INIT", action: `Node role: ${role}, primary: ${primary}`});
  
  // Faster processing timer for better throughput
  setInterval(() => {
    if (myNodeID === nodeIDs[0] && SBFTState.pendingRequests.length > 0) {
      processNextRequest();
    }
  }, 100);
}

function signSBFTMessage(msgObj) {
  const msgString = JSON.stringify(msgObj);
  return cryptoHelper.signMessage(myPrivateKey, msgString);
}

function verifySBFTSignature(sender, msgObj, signature) {
  try {
    const pubKey = cryptoHelper.loadPublicKey(sender);
    const msgString = JSON.stringify(msgObj);
    return cryptoHelper.verifySignature(pubKey, msgString, signature);
  } catch(e) {
    return false;
  }
}

function handleClientRequest(request, myNodeID) {
  // Queue request for sequential processing
  SBFTState.pendingRequests.push({ ...request, submitTime: Date.now() });
  logSBFTEvent({ node: myNodeID, phase: "CLIENT", action: `Request queued for processing`, details: request });
}

// Process requests with controlled concurrency
function processNextRequest() {
  if (SBFTState.pendingRequests.length === 0) return;
  
  // Allow up to 3 concurrent transactions
  const maxConcurrent = 3;
  const activeTransactions = Object.values(SBFTState.log).filter(entry => 
    entry && !entry.executed
  ).length;
  
  if (activeTransactions >= maxConcurrent) return;
  
  const request = SBFTState.pendingRequests.shift();
  SBFTState.sequence += 1;
  const seq = SBFTState.sequence;

  SBFTState.log[seq] = {
    request,
    commits: new Set(),
    executed: false,
    submitTime: request.submitTime
  };

  logSBFTEvent({ node: myNodeID, phase: "CLIENT", action: `Processing request #${seq}`, details: request });

  const prepareMsg = {
    seq,
    request
  };
  
  broadcastSBFTMessage('PREPARE', myNodeID, seq, prepareMsg);
  logSBFTEvent({ node: myNodeID, phase: "PREPARE", action: `Primary sent PREPARE for req #${seq}` });
}

function handleSBFTMessage(msg, myNodeID) {
  const { type, sender, seq, data, signature } = msg;
  messageCount++;
  
  // Apply Byzantine behavior
  if (myBehavior === 'silent' && messageCount > 2) {
    logSBFTEvent({node: myNodeID, phase: "BYZANTINE", action: `Silent node ignoring message #${messageCount}`});
    return; // Silent nodes stop responding after initial messages
  }
  
  if (myBehavior === 'delay') {
    const delay = Math.random() * 2000 + 1000; // 1-3 second delay
    logSBFTEvent({node: myNodeID, phase: "BYZANTINE", action: `Delaying message by ${delay.toFixed(0)}ms`});
    setTimeout(() => processSBFTMessage(msg, myNodeID), delay);
    return;
  }
  
  processSBFTMessage(msg, myNodeID);
}

function processSBFTMessage(msg, myNodeID) {
  const { type, sender, seq, data, signature } = msg;

  const msgToVerify = {type, sender, seq, data};
  if (!verifySBFTSignature(sender, msgToVerify, signature)) {
    logSBFTEvent({node: myNodeID, phase: "SECURITY", action: `Invalid signature from ${sender}`});
    return;
  }

  SBFTState.log[seq] = SBFTState.log[seq] || {
    request: null,
    commits: new Set(),
    executed: false
  };
  
  let logEntry = SBFTState.log[seq];

  if (type === 'PREPARE') {
    logEntry.request = data.request;
    
    logSBFTEvent({node: myNodeID, phase: "PREPARE", action: `Accepted PREPARE for req#${seq} from ${sender}`});

    // All nodes send COMMIT (with Byzantine behavior)
    let commitMsg = {
      seq,
      request: data.request
    };
    
    // Apply corrupt behavior
    if (myBehavior === 'corrupt' && Math.random() < 0.5) {
      commitMsg.request = {...commitMsg.request, value: Math.floor(Math.random() * 1000)};
      logSBFTEvent({node: myNodeID, phase: "BYZANTINE", action: `Corrupted request value to ${commitMsg.request.value}`});
    }
    
    // Apply random behavior
    if (myBehavior === 'random') {
      const behaviors = ['ignore', 'corrupt', 'delay'];
      const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
      
      if (randomBehavior === 'ignore') {
        logSBFTEvent({node: myNodeID, phase: "BYZANTINE", action: `Random behavior: ignoring COMMIT`});
        return;
      } else if (randomBehavior === 'corrupt') {
        commitMsg.request = {...commitMsg.request, value: Math.floor(Math.random() * 1000)};
        logSBFTEvent({node: myNodeID, phase: "BYZANTINE", action: `Random behavior: corrupted value`});
      }
    }
    
    broadcastSBFTMessage('COMMIT', myNodeID, seq, commitMsg);
    logSBFTEvent({node: myNodeID, phase: "COMMIT", action: `Sent COMMIT for req #${seq}`});
    
    // Add self to commits
    logEntry.commits.add(myNodeID);
  }

  if (type === 'COMMIT') {
    logEntry.commits.add(sender);
    logSBFTEvent({ node: myNodeID, phase: "COMMIT", action: `Accepted COMMIT for req #${seq} from ${sender}`, details: { totalCommits: logEntry.commits.size } });

    // Need 2f+1 commits
    const requiredQuorum = 2 * SBFTState.f + 1;
    if (logEntry.commits.size >= requiredQuorum && !logEntry.executed) {
      logEntry.executed = true;
      logSBFTEvent({node: myNodeID, phase: "EXECUTION", action: `Executed request #${seq} ✅`});
      
      // Prevent duplicate execution
      if (!SBFTState.executedRequests.has(logEntry.request?.id)) {
        SBFTState.executedRequests.add(logEntry.request?.id);

        // Apply corrupt behavior to final commit
        let commitValue = logEntry.request?.value || 0;
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
          logSBFTEvent({node: myNodeID, phase: "CORRUPT", action: `Corrupted value ${logEntry.request?.value} -> ${commitValue}`});
        }

        sbftCommitLog.push({
          committedAt: new Date().toISOString(),
          operation: logEntry.request?.operation || 'unknown',
          value: commitValue,
          sequence: seq,
          totalTimeMs: logEntry.submitTime ? (Date.now() - logEntry.submitTime) : null
        });
      }
      
      // Transaction completed
    }
  }
}

function broadcastSBFTMessage(type, myNodeID, seq, data) {
  const allNodes = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
  const myIdx = allNodes.indexOf(myNodeID);
  const restNodes = graph.nodeIPsArray.map((obj, idx) => idx !== myIdx ? Object.values(obj)[0] : null).filter(Boolean);

  const ips = restNodes.map(n => n.ip);
  const ports = restNodes.map(n => n.port);
  const endpoints = ports.map(() => 'api/sbft');

  const msgObj = { type, sender: myNodeID, seq, data };
  const signature = signSBFTMessage(msgObj);
  const signedMsg = {...msgObj, signature};

  broadcastNew.sendPostRequestsToIPs(signedMsg, ips, ports, endpoints, myNodeID);
}

function getSBFTNodeLog() {
  return sbftLog;
}

function getSBFTCommitLog() {
  return sbftCommitLog;
}

module.exports = {
  setNodeContext,
  handleClientRequest,
  handleSBFTMessage,
  getSBFTNodeLog,
  getSBFTCommitLog
};