const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');
const crypto = require('crypto');

// Enable or disable console logs here - can be controlled via environment variable
const ENABLE_LOGGING = process.env.PBFT_VERBOSE === 'true' || process.env.PBFT_VERBOSE === '1';

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

// PBFT state with request queue
const PBFTState = {
  sequence: 0,
  view: 0,
  f: 1,
  log: {},
  primary: null,
  inViewChange: false,
  pendingRequests: [],
  executedRequests: new Set(),
  processingTransaction: false,
  nextExecuteSeq: 1  // Track next sequence to execute in order
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
    if (ENABLE_LOGGING) console.log(`Node ${nodeID} behavior: ${myBehavior}`);
  } catch (error) {
    myBehavior = 'honest';
  }
  
  myNodeID = nodeID;
  myPrivateKey = cryptoHelper.loadPrivateKey(nodeID);
  myPublicKey = cryptoHelper.loadPublicKey(nodeID);
  PBFTState.f = Math.floor((nodeIDs.length - 1) / 3);
  PBFTState.primary = getPrimary(PBFTState.view);
  logPBFTEvent({node: myNodeID, phase: "INIT", action: `Node initialized as ${nodeID}, f=${PBFTState.f}`});
  
  // Primary processes requests with optimized intervals
  setInterval(() => {
    if (myNodeID === PBFTState.primary && PBFTState.pendingRequests.length > 0) {
      processNextRequest();
    }
  }, 10);
  
  // All nodes check for sequential execution with faster polling
  setInterval(() => {
    executeInOrder();
  }, 10);
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

// Handling the client request
function handleClientRequest(request, myNodeID) {
  if (PBFTState.inViewChange) {
    logPBFTEvent({node: myNodeID, phase: "CLIENT", action: `Ignoring client request during view change.`});
    return;
  }
  
  // Queue request for sequential processing
  PBFTState.pendingRequests.push({ ...request, submitTime: Date.now() });
  logPBFTEvent({ node: myNodeID, phase: "CLIENT", action: `Request queued for processing`, details: request });
  if (myNodeID === getPrimary(PBFTState.view)) {
    processNextRequest();
  }
}

const MAX_IN_FLIGHT = 10; // Window of maximum concurrent in-flight sequences

// Process requests with batch optimization and flow control
function processNextRequest() {
  if (PBFTState.pendingRequests.length === 0 || PBFTState.inViewChange) return;
  
  // Pipeline flow control: ensure network is not flooded by capping concurrent uncommitted transactions
  const inFlight = Math.max(0, PBFTState.sequence - PBFTState.nextExecuteSeq + 1);
  if (inFlight >= MAX_IN_FLIGHT) return;
  
  const availableSlots = Math.max(1, MAX_IN_FLIGHT - inFlight);
  const batchSize = Math.min(availableSlots, PBFTState.pendingRequests.length);
  
  for (let i = 0; i < batchSize; i++) {
    const request = PBFTState.pendingRequests.shift();
    if (!request) break;
    
    PBFTState.sequence += 1;
    const seq = PBFTState.sequence;
    const digest = digestMessage(request);

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

    PBFTState.log[seq].request = request;
    PBFTState.log[seq].digest = digest;
    PBFTState.log[seq].submitTime = request.submitTime;
    PBFTState.log[seq].prepares.add(myNodeID);

    const prePrepareMsg = {
      view: PBFTState.view,
      seq,
      digest,
      request
    };
    
    PBFTState.log[seq].preprepare = prePrepareMsg;
    broadcastPBFTMessage('PRE-PREPARE', myNodeID, seq, prePrepareMsg);
    logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Sent PRE-PREPARE for seq #${seq}`});
  }
}

// Execute transactions in sequential order
function executeInOrder() {
  while (PBFTState.log[PBFTState.nextExecuteSeq] && 
         PBFTState.log[PBFTState.nextExecuteSeq].committed_local && 
         PBFTState.log[PBFTState.nextExecuteSeq].request && 
         !PBFTState.log[PBFTState.nextExecuteSeq].executed) {
    
    const seq = PBFTState.nextExecuteSeq;
    const logEntry = PBFTState.log[seq];
    logEntry.executed = true;
    const request = logEntry.request;
    
    if (request && !PBFTState.executedRequests.has(request.id)) {
      PBFTState.executedRequests.add(request.id);

      // Apply corrupt behavior - modify transaction values
      let commitValue = request.value;
      if (myBehavior === 'corrupt') {
        const corruptionTypes = ['add', 'multiply', 'random'];
        const corruptionType = corruptionTypes[Math.floor(Math.random() * corruptionTypes.length)];
        
        switch (corruptionType) {
          case 'add':
            commitValue = request.value + Math.floor(Math.random() * 100) + 1;
            break;
          case 'multiply':
            commitValue = request.value * (Math.floor(Math.random() * 3) + 2);
            break;
          case 'random':
            commitValue = Math.floor(Math.random() * 1000) + 1;
            break;
        }
        logPBFTEvent({node: myNodeID, phase: "CORRUPT", action: `Corrupted value ${request.value} -> ${commitValue}`});
      }
      
      // Add the message to the commit log
      pbftCommitLog.push({
        committedAt: new Date().toISOString(),
        operation: request.operation || 'TX',
        value: commitValue,
        sequence: seq,
        totalTimeMs: logEntry.submitTime ? (Date.now() - logEntry.submitTime) : (request.submitTime ? (Date.now() - request.submitTime) : null)
      });
      
      logPBFTEvent({node: myNodeID, phase: "EXECUTION", action: `Executed request #${seq} in order ✅`});
    }
    
    PBFTState.nextExecuteSeq++;
    if (myNodeID === getPrimary(PBFTState.view)) {
      setImmediate(processNextRequest);
    }
  }
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
    // Only accept from primary
    const currentPrimary = getPrimary(data.view);
    if (sender !== currentPrimary) {
      logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Rejected: Not from primary (${sender} != ${currentPrimary})`});
      return;
    }
    
    // Check if the view number matches
    if (data.view !== PBFTState.view) {
      logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Rejected: View number mismatch (msg: ${data.view}, local: ${PBFTState.view})`});
      return;
    }
    
    // Check if already have pre-prepare for this sequence
    if (logEntry.preprepare) {
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
    logEntry.prepares.add(myNodeID);
    logEntry.prepares.add(sender);
    logPBFTEvent({node: myNodeID, phase: "PRE-PREPARE", action: `Accepted PRE-PREPARE for req#${seq} from ${sender}`});
    
    // Send PREPARE vote directly to Primary (Linear Collector Pattern)
    const prepareMsg = {
      view: PBFTState.view,
      seq,
      digest: data.digest
    };
    
    sendMessageToNode('PREPARE', currentPrimary, seq, prepareMsg);
    logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Sent PREPARE for req #${seq} to Primary`});

    if (logEntry.committed_local) {
      executeInOrder();
    }
  }

  // Handling the PREPARE Phase (Processed by Primary)
  if (type === 'PREPARE') {
    if (data.view !== PBFTState.view) return;
    if (logEntry.digest && logEntry.digest !== data.digest) return;

    logEntry.prepares.add(sender);
    if (!logEntry.digest && data.digest) {
      logEntry.digest = data.digest;
    }

    const currentPrimary = getPrimary(data.view);
    // When Primary collects 2f prepares, broadcast COMMIT to all nodes
    if (myNodeID === currentPrimary && logEntry.prepares.size >= 2 * PBFTState.f && !logEntry.prepared && logEntry.request) {
      logEntry.prepared = true;
      logEntry.committed_local = true;
      logPBFTEvent({node: myNodeID, phase: "PREPARE", action: `Request #${seq} is prepared at Primary (collected ${logEntry.prepares.size} votes).`});
      
      const commitMsg = {
        view: PBFTState.view,
        seq,
        digest: logEntry.digest,
        request: logEntry.request
      };
      
      broadcastPBFTMessage('COMMIT', myNodeID, seq, commitMsg);
      logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Primary broadcasted COMMIT for req #${seq}`});
      executeInOrder();
    }
  }

  // Handling the COMMIT Phase
  if (type === 'COMMIT') {
    if (data.view !== PBFTState.view) return;
    if (logEntry.digest && logEntry.digest !== data.digest) return;

    if (data.request) {
      logEntry.request = data.request;
    }
    if (data.digest) {
      logEntry.digest = data.digest;
    }

    logEntry.committed_local = true;
    logPBFTEvent({node: myNodeID, phase: "COMMIT", action: `Request #${seq} committed_local on receipt of COMMIT`});
    executeInOrder();
  }
}

function sendMessageToNode(type, targetNodeID, seq, data) {
  const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === targetNodeID);
  if (!targetNode) return;
  
  const nodeInfo = Object.values(targetNode)[0];
  const msgObj = { type, sender: myNodeID, seq, data };
  const signature = signPBFTMessage(msgObj);
  const signedMsg = { ...msgObj, signature };
  broadcastNew.sendPostRequestsToIPs(signedMsg, [nodeInfo.ip], [nodeInfo.port], ['api/pbft'], myNodeID);
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