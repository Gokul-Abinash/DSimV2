const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastWithLatency.js');
const cryptoHelper = require('./helper_modules/cryptoHelper.js');

const ENABLE_LOGGING = false;
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
  isReplicating: false,
  pendingReplication: false
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID, myPrivateKey, myPublicKey, myBehavior = 'honest';

function setNodeContext(nodeID) {
  // Load Byzantine configuration
  try {
    const byzantineConfig = require('./byzantine-config.js');
    myBehavior = byzantineConfig[nodeID] || 'honest';
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
  if (RaftState.heartbeatInterval) {
    clearInterval(RaftState.heartbeatInterval);
    RaftState.heartbeatInterval = null;
  }
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
  if (RaftState.heartbeatInterval) clearInterval(RaftState.heartbeatInterval);
  RaftState.heartbeatInterval = setInterval(() => {
    sendHeartbeats();
  }, HEARTBEAT_INTERVAL);
}

function sendHeartbeats() {
  if (RaftState.state !== 'leader') return;
  
  const targetIPs = [];
  const targetPorts = [];
  const targetEndpoints = [];
  
  for (const nodeId of nodeIDs) {
    if (nodeId !== myNodeID) {
      const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === nodeId);
      if (targetNode) {
        const nodeInfo = Object.values(targetNode)[0];
        targetIPs.push(nodeInfo.ip);
        targetPorts.push(nodeInfo.port);
        targetEndpoints.push('api/raft');
      }
    }
  }
  
  if (targetIPs.length > 0) {
    const appendEntries = {
      term: RaftState.currentTerm,
      leaderId: myNodeID,
      prevLogIndex: RaftState.log.length,
      prevLogTerm: RaftState.log.length > 0 ? RaftState.log[RaftState.log.length - 1].term : 0,
      entries: [],
      leaderCommit: RaftState.commitIndex
    };
    
    const msgObj = { type: 'APPEND_ENTRIES', sender: myNodeID, data: appendEntries };
    const signature = signRaftMessage(msgObj);
    const signedMsg = { ...msgObj, signature };
    
    broadcastNew.sendPostRequestsToIPs(signedMsg, targetIPs, targetPorts, targetEndpoints, myNodeID);
  }
}

function handleClientRequest(request, myNodeID) {
  if (RaftState.state !== 'leader') {
    logRaftEvent({node: myNodeID, phase: "CLIENT", action: `Not leader, ignoring request`});
    return;
  }
  
  const logEntry = {
    term: RaftState.currentTerm,
    index: RaftState.log.length + 1,
    command: request,
    submitTime: Date.now()
  };
  
  RaftState.log.push(logEntry);
  RaftState.matchIndex[myNodeID] = logEntry.index;
  logRaftEvent({node: myNodeID, phase: "CLIENT", action: `Added entry ${logEntry.index} to log`, details: request});
  
  // Trigger pipelined replication
  triggerReplication();
}

let replicationTimer = null;
function triggerReplication() {
  if (replicationTimer) return;
  replicationTimer = setTimeout(() => {
    replicationTimer = null;
    broadcastReplication();
  }, 10);
}

function broadcastReplication() {
  if (RaftState.state !== 'leader' || RaftState.log.length === 0) return;
  
  const targetIPs = [];
  const targetPorts = [];
  const targetEndpoints = [];
  
  for (const nodeId of nodeIDs) {
    if (nodeId !== myNodeID) {
      const targetNode = graph.nodeIPsArray.find(obj => Object.keys(obj)[0] === nodeId);
      if (targetNode) {
        const nodeInfo = Object.values(targetNode)[0];
        targetIPs.push(nodeInfo.ip);
        targetPorts.push(nodeInfo.port);
        targetEndpoints.push('api/raft');
      }
    }
  }
  
  if (targetIPs.length === 0) return;
  
  // Send the full current log / latest entries to all followers
  const appendEntries = {
    term: RaftState.currentTerm,
    leaderId: myNodeID,
    prevLogIndex: 0,
    prevLogTerm: 0,
    entries: RaftState.log,
    leaderCommit: RaftState.commitIndex
  };
  
  const msgObj = { type: 'APPEND_ENTRIES', sender: myNodeID, data: appendEntries };
  const signature = signRaftMessage(msgObj);
  const signedMsg = { ...msgObj, signature };
  
  broadcastNew.sendPostRequestsToIPs(signedMsg, targetIPs, targetPorts, targetEndpoints, myNodeID);
}

function handleRaftMessage(msg, myNodeID) {
  const { type, sender, data, signature } = msg;

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
    
    if (entries && entries.length > 0) {
      if (prevLogIndex === 0) {
        RaftState.log = [...entries];
        success = true;
      } else if (prevLogIndex <= RaftState.log.length) {
        RaftState.log = RaftState.log.slice(0, prevLogIndex);
        RaftState.log.push(...entries);
        success = true;
      }
    } else {
      success = true;
    }
    
    // Update commit index
    if (leaderCommit > RaftState.commitIndex) {
      RaftState.commitIndex = Math.min(leaderCommit, RaftState.log.length);
      applyCommittedEntries();
    }
    
    const appendResponse = {
      term: RaftState.currentTerm,
      success,
      matchIndex: RaftState.log.length
    };
    
    sendRaftMessage('APPEND_ENTRIES_RESPONSE', myNodeID, sender, appendResponse);
  }

  if (type === 'APPEND_ENTRIES_RESPONSE' && RaftState.state === 'leader') {
    const { success, matchIndex } = data;
    
    if (success) {
      RaftState.matchIndex[sender] = Math.max(RaftState.matchIndex[sender] || 0, matchIndex);
      RaftState.nextIndex[sender] = matchIndex + 1;
      updateCommitIndex();
    } else {
      RaftState.nextIndex[sender] = Math.max(1, (RaftState.nextIndex[sender] || 2) - 1);
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
      if (i > RaftState.commitIndex) {
        RaftState.commitIndex = i;
        applyCommittedEntries();
        // Notify followers of updated commit index
        triggerReplication();
      }
      break;
    }
  }
}

function applyCommittedEntries() {
  while (RaftState.lastApplied < RaftState.commitIndex) {
    RaftState.lastApplied++;
    const entry = RaftState.log[RaftState.lastApplied - 1];
    if (entry) {
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