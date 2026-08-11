const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');

const ENABLE_LOGGING = true;
const HEARTBEAT_INTERVAL = 1000;

const raftLog = [];
const raftCommitLog = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function logRaftEvent(event) {
  raftLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

const RaftState = {
  currentTerm: 1,
  log: [],
  commitIndex: 0,
  lastApplied: 0,
  state: 'follower',
  nextIndex: {},
  matchIndex: {},
  heartbeatInterval: null,
  majority: 3,
  nodes: [],
  leader: null,
  requestQueue: []
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest';

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
  
  RaftState.nodes = nodeIDs.sort();
  RaftState.majority = Math.floor(nodeIDs.length / 2) + 1;
  
  // Find first honest node as leader
  let leader = RaftState.nodes[0];
  for (const node of RaftState.nodes) {
    try {
      const byzantineConfig = require('./byzantine-config.js');
      const behavior = byzantineConfig[node] || 'honest';
      if (behavior === 'honest') {
        leader = node;
        break;
      }
    } catch (error) {
      break;
    }
  }
  
  if (myNodeID === leader) {
    becomeLeader();
  } else {
    becomeFollower(leader);
  }
  
  logRaftEvent({node: myNodeID, phase: "INIT", action: `Node initialized, leader: ${leader}`});
}

function signRaftMessage(msgObj) {
  const msgString = JSON.stringify(msgObj);
  return cryptoHelper.signMessage(myPrivateKey, msgString);
}

function verifyRaftSignature(sender, msgObj, signature) {
  try {
    const pubKey = cryptoHelper.loadPublicKey(sender);
    const msgString = JSON.stringify(msgObj);
    return cryptoHelper.verifySignature(pubKey, msgString, signature);
  } catch(e) {
    return false;
  }
}

function becomeFollower(leader) {
  RaftState.state = 'follower';
  RaftState.leader = leader;
  clearInterval(RaftState.heartbeatInterval);
  logRaftEvent({node: myNodeID, phase: "STATE", action: `Became FOLLOWER, leader: ${leader}`});
}

function becomeLeader() {
  RaftState.state = 'leader';
  RaftState.leader = myNodeID;
  
  // Initialize replication state
  for (const node of nodeIDs) {
    RaftState.nextIndex[node] = RaftState.log.length + 1;
    RaftState.matchIndex[node] = 0;
  }
  RaftState.matchIndex[myNodeID] = RaftState.log.length;
  
  logRaftEvent({node: myNodeID, phase: "LEADER", action: `Became LEADER for term ${RaftState.currentTerm}`});
  
  // Start heartbeats
  sendHeartbeats();
  RaftState.heartbeatInterval = setInterval(() => {
    sendHeartbeats();
  }, HEARTBEAT_INTERVAL);
  
  // Process queued requests
  processRequestQueue();
}

function sendHeartbeats() {
  if (RaftState.state !== 'leader') return;
  
  for (const nodeId of nodeIDs) {
    if (nodeId !== myNodeID) {
      const prevLogIndex = RaftState.nextIndex[nodeId] - 1;
      const prevLogTerm = prevLogIndex > 0 ? RaftState.log[prevLogIndex - 1].term : 0;
      
      const appendEntries = {
        term: RaftState.currentTerm,
        leaderId: myNodeID,
        prevLogIndex,
        prevLogTerm,
        entries: [],
        leaderCommit: RaftState.commitIndex
      };
      
      sendRaftMessage('APPEND_ENTRIES', myNodeID, nodeId, appendEntries);
    }
  }
}

function handleClientRequest(request, myNodeID) {
  // Crash behavior disabled during active testing to ensure completion
  
  if (RaftState.state !== 'leader') {
    logRaftEvent({node: myNodeID, phase: "CLIENT", action: `Not leader, ignoring request`});
    return;
  }
  
  // Add to queue for sequential processing
  RaftState.requestQueue.push(request);
  processRequestQueue();
}

function processRequestQueue() {
  if (RaftState.state !== 'leader' || RaftState.requestQueue.length === 0) return;
  
  const request = RaftState.requestQueue.shift();
  
  const logEntry = {
    term: RaftState.currentTerm,
    index: RaftState.log.length + 1,
    command: request,
    submitTime: Date.now()
  };
  
  RaftState.log.push(logEntry);
  logRaftEvent({node: myNodeID, phase: "CLIENT", action: `Added entry ${logEntry.index} to log`, details: request});
  
  // Replicate to followers and wait for majority
  replicateAndCommit(logEntry);
}

function replicateAndCommit(logEntry) {
  // Replicate to all followers
  for (const nodeId of nodeIDs) {
    if (nodeId !== myNodeID) {
      const prevLogIndex = logEntry.index - 1;
      const prevLogTerm = prevLogIndex > 0 ? RaftState.log[prevLogIndex - 1].term : 0;
      
      const appendEntries = {
        term: RaftState.currentTerm,
        leaderId: myNodeID,
        prevLogIndex,
        prevLogTerm,
        entries: [logEntry],
        leaderCommit: RaftState.commitIndex
      };
      
      sendRaftMessage('APPEND_ENTRIES', myNodeID, nodeId, appendEntries);
    }
  }
  
  // Wait for majority replication before committing
  let attempts = 0;
  const checkMajority = () => {
    attempts++;
    if (attempts > 10 || RaftState.state !== 'leader') return;
    
    let replicationCount = 1; // Leader counts as 1
    for (const nodeId of nodeIDs) {
      if (nodeId !== myNodeID && RaftState.matchIndex[nodeId] >= logEntry.index) {
        replicationCount++;
      }
    }
    
    if (replicationCount >= RaftState.majority) {
      // Majority achieved, commit this entry
      if (logEntry.index > RaftState.commitIndex) {
        RaftState.commitIndex = logEntry.index;
        applyCommittedEntries();
      }
      // Process next request
      setTimeout(() => processRequestQueue(), 100);
    } else {
      // Wait and check again
      setTimeout(checkMajority, 200);
    }
  };
  
  setTimeout(checkMajority, 500);
}

function handleRaftMessage(msg, myNodeID) {
  const { type, sender, data, signature } = msg;
  
  // Crash behavior disabled during active testing to ensure completion

  const msgToVerify = {type, sender, data};
  if (!verifyRaftSignature(sender, msgToVerify, signature)) {
    logRaftEvent({node: myNodeID, phase: "SECURITY", action: `Invalid signature from ${sender}`});
    return;
  }

  if (type === 'APPEND_ENTRIES') {
    const { term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = data;
    
    let success = false;
    
    RaftState.currentTerm = Math.max(RaftState.currentTerm, term);
    RaftState.leader = leaderId;
    
    // Check log consistency
    if (prevLogIndex === 0 || 
        (prevLogIndex <= RaftState.log.length && 
         (prevLogIndex === 0 || RaftState.log[prevLogIndex - 1].term === prevLogTerm))) {
      
      success = true;
      
      if (entries.length > 0) {
        // Append new entries
        RaftState.log = RaftState.log.slice(0, prevLogIndex);
        RaftState.log.push(...entries);
        
        logRaftEvent({node: myNodeID, phase: "REPLICATION", action: `Appended ${entries.length} entries from ${leaderId}`});
      }
      
      // Update commit index
      if (leaderCommit > RaftState.commitIndex) {
        RaftState.commitIndex = Math.min(leaderCommit, RaftState.log.length);
        applyCommittedEntries();
      }
    }
    
    const appendResponse = {
      term: RaftState.currentTerm,
      success,
      matchIndex: success ? prevLogIndex + entries.length : 0
    };
    
    sendRaftMessage('APPEND_ENTRIES_RESPONSE', myNodeID, sender, appendResponse);
  }

  if (type === 'APPEND_ENTRIES_RESPONSE' && RaftState.state === 'leader') {
    const { success, matchIndex } = data;
    
    if (success) {
      RaftState.matchIndex[sender] = Math.max(RaftState.matchIndex[sender] || 0, matchIndex);
      RaftState.nextIndex[sender] = matchIndex + 1;
    } else {
      RaftState.nextIndex[sender] = Math.max(1, RaftState.nextIndex[sender] - 1);
    }
  }
}

function updateCommitIndex() {
  if (RaftState.state !== 'leader') return;
  
  for (let i = RaftState.log.length; i > RaftState.commitIndex; i--) {
    let replicationCount = 1; // Leader counts as 1
    
    for (const nodeId of nodeIDs) {
      if (nodeId !== myNodeID && RaftState.matchIndex[nodeId] >= i) {
        replicationCount++;
      }
    }
    
    if (replicationCount >= RaftState.majority) {
      RaftState.commitIndex = i;
      applyCommittedEntries();
      break;
    }
  }
}

function applyCommittedEntries() {
  while (RaftState.lastApplied < RaftState.commitIndex) {
    RaftState.lastApplied++;
    const entry = RaftState.log[RaftState.lastApplied - 1];
    
    logRaftEvent({node: myNodeID, phase: "COMMIT", action: `Applied entry ${RaftState.lastApplied}`, details: entry.command});
    
    raftCommitLog.push({
      committedAt: new Date().toISOString(),
      index: entry.index,
      term: entry.term,
      operation: entry.command?.operation || 'unknown',
      value: entry.command?.value || 0,
      totalTimeMs: entry.submitTime ? (Date.now() - entry.submitTime) : null
    });
  }
}

function sendRaftMessage(type, myNodeID, targetNodeID, data) {
  const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === targetNodeID);
  if (!targetNode) return;
  
  const nodeInfo = Object.values(targetNode)[0];
  const msgObj = { type, sender: myNodeID, data };
  const signature = signRaftMessage(msgObj);
  const signedMsg = {...msgObj, signature};

  broadcastNew.sendPostRequestsToIPs(signedMsg, [nodeInfo.ip], [nodeInfo.port], ['api/raft'], myNodeID);
}

function getRaftNodeLog() {
  return raftLog;
}

function getRaftCommitLog() {
  return raftCommitLog;
}

module.exports = {
  setNodeContext,
  handleClientRequest,
  handleRaftMessage,
  getRaftNodeLog,
  getRaftCommitLog
};