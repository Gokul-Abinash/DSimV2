const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');
const crypto = require('crypto');

// Enable or disable console logs here
const ENABLE_LOGGING = true;

// In-memory array to store all PBFT log events for API access
const pbftLog = [];
const pbftCommitLog = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function digestMessage(message) {
  return crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex');
}

// Centralized logger: logs to console if enabled and always stores event for API
function logPBFTEvent(event) {
  pbftLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

// PBFT state
const PBFTState = {
  sequence: 0,
  view: 0,
  f: 1, // Fixed for 4 nodes
  log: {},
  primary: 'A',
  inViewChange: false
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);

// Key context
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest', messageCount = 0;

// Key context setter
function setNodeContext(nodeID) {
  // Load Byzantine configuration
  try {
    const byzantineConfig = require('./byzantine-config.js');
    myBehavior = byzantineConfig[nodeID] || 'honest';
    console.log(`Node ${nodeID} behavior: ${myBehavior}`);
  } catch (error) {
    myBehavior = 'honest';
  }  myNodeID = nodeID;
  myPrivateKey = cryptoHelper.loadPrivateKey(nodeID);
  myPublicKey = cryptoHelper.loadPublicKey(nodeID);
  PBFTState.f = 1; // Fixed for 4 nodes
  PBFTState.primary = getPrimary(PBFTState.view);
  logPBFTEvent({node: myNodeID, phase: "INIT", action: `Node initialized as ${nodeID}, f=${PBFTState.f}`});
}

function signPBFTMessage(msgObj) {
  const msgString = JSON.stringify(msgObj);
  return cryptoHelper.signMessage(myPrivateKey, msgString);
}

function verifyPBFTSignature(sender, msgObj, signature) {
  try {
    const pubKey = cryptoHelper.loadPublicKey(sender);
    const msgString = JSON.stringify(msgObj);
    return cryptoHelper.verifySignature(pubKey, msgString, signature);
  } catch(e) {
    return false;
  }
}

function getPrimary(view) {
  return nodeIDs[view % nodeIDs.length];
}

// PBFT State Checkers
function isPrepared(logEntry) {
  return (
    logEntry.preprepare &&
    logEntry.prepares &&
    logEntry.prepares.size >= 2 * PBFTState.f
  );
}

function isCommittedLocal(logEntry) {
  return (
    logEntry.prepared &&
    logEntry.commits &&
    logEntry.commits.size >= 2 * PBFTState.f + 1
  );
}

// Handling the client request
function handleClientRequest(request, myNodeID) {
  if (PBFTState.inViewChange) {
    logPBFTEvent({node: myNodeID, phase: "CLIENT", action: `Ignoring client request during view change.`});
    return;
  }
  
  // Queue request for sequential processing
  PBFTState.pendingRequests.push({ ...request, submitTime: Date.now() });
  logPBFTEvent({ node: myNodeID, phase: "CLIENT", action: `Request queued for processing`, details: request });
}

// Process requests sequentially
function processNextRequest() {
  if (PBFTState.pendingRequests.length === 0 || PBFTState.inViewChange) return;
  
  const request = PBFTState.pendingRequests.shift();
  PBFTState.sequence += 1;
  const seq = PBFTState.sequence;
  const digest = digestMessage(request);

  PBFTState.log[seq] = {
    request,
    digest,
    preprepare: null,
    prepares: new Set(),
    commits: new Set(),
    executed: false,
    prepared: false,
    committed: false,
    committed_local: false,
    view: PBFTState.view,
    submitTime: request.submitTime
  };

  logPBFTEvent({ node: myNodeID, phase: "CLIENT", action: `Processing request #${seq}`, details: request });

  const prePrepareMsg = {
    view: PBFTState.view,
    seq,
    digest,
    request
  };
  
  const msgObj = {
    type: 'PRE-PREPARE',
    sender: myNodeID,
    seq,
    data: prePrepareMsg,
    signature: signPBFTMessage({
      type: 'PRE-PREPARE',
      sender: myNodeID,
      seq,
      data: prePrepareMsg
    })
  };
  
  broadcastPBFTMessage('PRE-PREPARE', myNodeID, seq, prePrepareMsg);
  logPBFTEvent({ node: myNodeID, phase: "PRE-PREPARE", action: `Broadcasted PRE-PREPARE for req #${seq}` });
  handlePBFTMessage(msgObj, myNodeID);
}

// PBFT Message Handler
function handlePBFTMessage(msg, myNodeID) {
  const { type, sender, seq, data, signature } = msg;

  // Verify the Signature
  const msgToVerify = {type, sender, seq, data};
  if (!verifyPBFTSignature(sender, msgToVerify, signature)) {
    logPBFTEvent({node: myNodeID, phase: "SECURITY", action: `Invalid signature from ${sender}`});
    return;
  }

  if (PBFTState.inViewChange && !['CHECKPOINT', 'VIEW-CHANGE', 'NEW-VIEW'].includes(type)) {
    logPBFTEvent({node: myNodeID, phase: type, action: `Ignoring ${type} during view change.`});
    return;
  }

  // Ensure if the log entry exists
  PBFTState.log[seq] = PBFTState.log[seq] || {
    request: null,
    digest: null,
    preprepare: null,
    prepares: new Set(),
    commits: new Set(),
    executed: false,
    prepared: false,
    committed: false,
    committed_local: false,
    view: PBFTState.view
  };
  
  let logEntry = PBFTState.log[seq];

  // Handling the PRE-PREPARE PHASE
  if (type === 'PRE-PREPARE') {
    // Check if the view number matches
    if (data.view !== PBFTState.view) {
      logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Rejected: View number mismatch (msg: ${data.view}, local: ${PBFTState.view})`});
      return;
    }
    
    // Check if the digest matches
    const computedDigest = digestMessage(data.request);
    if (data.digest !== computedDigest) {
      logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Rejected: Digest mismatch!`});
      return;
    }
    
    // Final Acceptance of the PRE-PREPARE Phase
    logEntry.request = data.request;
    logEntry.digest = data.digest;
    logEntry.preprepare = data;
    logEntry.view = data.view;
    logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Accepted PRE-PREPARE for req#${seq} from ${sender}`});
    
    logEntry.prepares.add(myNodeID);
    
    // Broadcasting the PREPARE Message
    const prepareMsg = {
      view: PBFTState.view,
      seq,
      digest: data.digest
    };
    
    broadcastPBFTMessage('PREPARE', myNodeID, seq, prepareMsg);
    logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Broadcasted PREPARE for req #${seq}`});
  }

  // Handling the PREPARE Phase
  if (type === 'PREPARE') {
    // Check for the view number
    if (data.view !== PBFTState.view) {
      logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Rejected: View number mismatch (msg: ${data.view}, local: ${PBFTState.view})`});
      return;
    }

    // Check if the digest matches pre-prepare
    if (!logEntry.preprepare || logEntry.digest !== data.digest) {
      logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Rejected: No matching PRE-PREPARE or digest mismatch`});
      return;
    }

    // Accept PREPARE message 
    logEntry.prepares.add(sender);
    logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Accepted PREPARE for req #${seq} from ${sender}`, details: {totalPrepares: logEntry.prepares.size}});

    // If prepared state reached, mark and log
    if (isPrepared(logEntry) && !logEntry.prepared) {
      logEntry.prepared = true;
      logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Request #${seq} is now prepared.`});
    }

    // Add self to prepares
    logEntry.prepares.add(myNodeID);

    // If 2f+1 prepares, broadcast COMMIT
    if (logEntry.prepares.size >= 2 * PBFTState.f + 1 && !logEntry.committed) {
      const commitMsg = {
        view: PBFTState.view,
        seq,
        digest: data.digest
      };
      
      broadcastPBFTMessage('COMMIT', myNodeID, seq, commitMsg);
      logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Broadcasted COMMIT for req #${seq}`});
      logEntry.committed = true;
    }
  }

  // Handling the COMMIT Phase
  if (type === 'COMMIT') {
    // Check if the view number is correct
    if (data.view !== PBFTState.view) {
      logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Rejected: View number mismatch (msg: ${data.view}, local: ${PBFTState.view})`});
      return;
    }
    
    // Check if the digest matches the pre-prepare
    if (!logEntry.preprepare || logEntry.digest !== data.digest) {
      logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Rejected: No matching PRE-PREPARE or digest mismatch`});
      return;
    }
    
    // Only accept commit if already have pre-prepare and enough prepares
    if (logEntry.prepares.size < 2 * PBFTState.f + 1) {
      logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Rejected: Not enough PREPAREs yet!`});
      return;
    }

    // Accept the commit message
    logEntry.commits.add(sender);
    logPBFTEvent({ node: myNodeID, phase: "COMMIT", action: `Accepted COMMIT for req #${seq} from ${sender}`, details: { totalCommits: logEntry.commits.size } });

    // If committed_local state reached, mark and log
    if (isCommittedLocal(logEntry) && !logEntry.committed_local) {
      logEntry.committed_local = true;
      logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Request #${seq} is now committed_local.`});

      // Apply corrupt behavior - modify transaction values
      let commitValue = logEntry.request.value;
      if (myBehavior === 'corrupt') {
        // Randomly corrupt the value
        const corruptionTypes = ['add', 'multiply', 'random'];
        const corruptionType = corruptionTypes[Math.floor(Math.random() * corruptionTypes.length)];
        
        switch (corruptionType) {
          case 'add':
            commitValue = logEntry.request.value + Math.floor(Math.random() * 100) + 1;
            break;
          case 'multiply':
            commitValue = logEntry.request.value * (Math.floor(Math.random() * 3) + 2);
            break;
          case 'random':
            commitValue = Math.floor(Math.random() * 1000) + 1;
            break;
        }
        logPBFTEvent({node: myNodeID, phase: "CORRUPT", action: `Corrupted value ${logEntry.request.value} -> ${commitValue}`});
      }
      
      // Add the message to the commit log
      pbftCommitLog.push({
        committedAt: new Date().toISOString(),
        operation: logEntry.request.operation,
        value: commitValue,
        totalTimeMs: logEntry.submitTime ? (Date.now() - logEntry.submitTime) : null
      });
    }

    // If 2f+1 commits then execute
    if (logEntry.commits.size >= 2 * PBFTState.f + 1 && !logEntry.executed) {
      logEntry.executed = true;
      logPBFTEvent({node: myNodeID, phase: "EXECUTION", action: `Executed/Completed request #${seq} ✅`});
    }
  }
}

// PBFT Message Broadcast
function broadcastPBFTMessage(type, myNodeID, seq, data) {
  const allNodes = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
  const myIdx = allNodes.indexOf(myNodeID);
  const restNodes = graph.nodeIPsArray.map((obj, idx) => idx !== myIdx ? Object.values(obj)[0] : null).filter(Boolean);

  const ips = restNodes.map(n => n.ip);
  const ports = restNodes.map(n => n.port);
  const endpoints = ports.map(() => 'api/pbft');

  const msgObj = { type, sender: myNodeID, seq, data };
  const signature = signPBFTMessage(msgObj);
  const signedMsg = {...msgObj, signature};

  broadcastNew.sendPostRequestsToIPs(signedMsg, ips, ports, endpoints, myNodeID);
}

function getPBFTNodeLog() {
  return pbftLog;
}

function getPBFTCommitLog() {
  return pbftCommitLog;
}

module.exports = {
  setNodeContext,
  handleClientRequest,
  handlePBFTMessage,
  getPBFTNodeLog,
  getPBFTCommitLog
};