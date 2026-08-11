const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastNew.js');

const ENABLE_LOGGING = true;
const ROUND_TIMEOUT_MS = 1200;
const AFTER_BROADCAST_WAIT_MS = 300;

const misLog = [];
const misResults = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function logMISEvent(event) {
  misLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

const MISState = {
  candidateSet: true,
  inMIS: false,
  localMIS: new Set(),
  currentRound: 0,
  myRandom: 0,
  receivedRandoms: {},
  running: false
};

const nodeIDs = graph.nodeIPsArray.map(obj => Object.keys(obj)[0]);
let myNodeID;

function setNodeContext(nodeID) {
  myNodeID = nodeID;
  MISState.candidateSet = true;
  MISState.inMIS = false;
  MISState.localMIS = new Set();
  MISState.currentRound = 0;
  MISState.receivedRandoms = {};
  MISState.running = false;
  
  logMISEvent({ node: myNodeID, phase: 'INIT', action: 'Node context set. Starting candidate=true' });
}

function handleMISMessage(msg, nodeID) {
  const { type, sender, data } = msg;
  
  switch (type) {
    case 'RANDOM':
      onReceiveRandom(data, sender);
      break;
    case 'MIS-NOTIFY':
      onReceiveMISNotification(data, sender);
      break;
  }
}

function onReceiveRandom(data, sender) {
  const { value, round } = data;
  if (typeof round === 'undefined' || typeof sender === 'undefined') {
    logMISEvent({ node: myNodeID, phase: 'RANDOM', action: `Malformed message from ${sender}` });
    return;
  }
  
  if (!MISState.receivedRandoms[round]) MISState.receivedRandoms[round] = {};
  MISState.receivedRandoms[round][sender] = value;
  logMISEvent({ node: myNodeID, phase: 'RANDOM', action: `Stored random from ${sender} for round ${round}: ${value}` });
}

function onReceiveMISNotification(data, sender) {
  if (!MISState.localMIS.has(sender)) {
    logMISEvent({ node: myNodeID, phase: 'MIS-NOTIFY', action: `Neighbor ${sender} joined MIS. Removing self from candidates.` });
    MISState.localMIS.add(sender);
  }
  MISState.candidateSet = false;
  MISState.inMIS = false;
  
  // Record final result when eliminated
  if (!misResults.some(r => r.node === myNodeID)) {
    misResults.push({
      node: myNodeID,
      round: MISState.currentRound,
      inMIS: false,
      randomValue: MISState.myRandom,
      timestamp: new Date().toISOString()
    });
  }
}

function waitForRoundMessages(round) {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start >= ROUND_TIMEOUT_MS) return resolve();
      setTimeout(check, 50);
    };
    check();
  });
}

async function runOneRound() {
  // Re-evaluate candidacy: if not in MIS and no MIS neighbors, become candidate again
  if (!MISState.candidateSet && !MISState.inMIS) {
    const neighbors = graph.getNeighborIPPort(myNodeID);
    if (neighbors && Array.isArray(neighbors.IPArray) && neighbors.IPArray.length > 0) {
      // Check if any neighbor is in MIS
      const neighborNodes = graph.graph.neighbors(myNodeID) || [];
      const hasMISNeighbor = neighborNodes.some(neighbor => MISState.localMIS.has(neighbor));
      
      if (!hasMISNeighbor) {
        MISState.candidateSet = true;
        logMISEvent({ node: myNodeID, phase: 'RECANDIDATE', action: 'No MIS neighbors found, becoming candidate again' });
      }
    } else {
      // Isolated node should be in MIS
      MISState.candidateSet = true;
      logMISEvent({ node: myNodeID, phase: 'RECANDIDATE', action: 'Isolated node, becoming candidate' });
    }
  }
  
  if (!MISState.candidateSet) {
    logMISEvent({ node: myNodeID, phase: 'ROUND', action: 'Not a candidate, skipping' });
    return false;
  }

  MISState.currentRound += 1;
  MISState.myRandom = Math.random();
  const round = MISState.currentRound;

  logMISEvent({ node: myNodeID, phase: 'ROUND', action: `Round ${round}: my random = ${MISState.myRandom}` });

  // Broadcast random to neighbors
  const neighbors = graph.getNeighborIPPort(myNodeID);
  if (neighbors && Array.isArray(neighbors.IPArray) && neighbors.IPArray.length > 0) {
    const payload = { value: MISState.myRandom, round };
    broadcastMessage('RANDOM', payload);
    logMISEvent({ node: myNodeID, phase: 'RANDOM', action: `Broadcasted random for round ${round} to ${neighbors.IPArray.length} neighbors` });
  }

  // Wait for neighbor responses
  await new Promise(r => setTimeout(r, AFTER_BROADCAST_WAIT_MS));
  await waitForRoundMessages(round);

  // Evaluate neighbor values
  const neighborMap = MISState.receivedRandoms[round] || {};
  const neighborNames = Object.keys(neighborMap);
  logMISEvent({ node: myNodeID, phase: 'ROUND', action: `Round ${round}: received ${neighborNames.length} neighbor randoms` });

  let maxNeighborVal = -Infinity;
  for (const n of neighborNames) {
    const v = neighborMap[n];
    if (typeof v === 'number' && v > maxNeighborVal) maxNeighborVal = v;
  }

  const isWinner = MISState.myRandom > maxNeighborVal;
  if (isWinner) {
    MISState.inMIS = true;
    MISState.candidateSet = false;
    MISState.localMIS.add(myNodeID);
    logMISEvent({ node: myNodeID, phase: 'WIN', action: `Round ${round}: I WON (myRandom=${MISState.myRandom} > maxNeighbor=${maxNeighborVal}). Join MIS.` });

    // Notify neighbors
    if (neighbors && Array.isArray(neighbors.IPArray) && neighbors.IPArray.length > 0) {
      broadcastMessage('MIS-NOTIFY', { from: myNodeID });
      logMISEvent({ node: myNodeID, phase: 'MIS-NOTIFY', action: `Notified ${neighbors.IPArray.length} neighbors of MIS membership` });
    }
    
    // Record result
    misResults.push({
      node: myNodeID,
      round: round,
      inMIS: true,
      randomValue: MISState.myRandom,
      timestamp: new Date().toISOString()
    });
  } else {
    logMISEvent({ node: myNodeID, phase: 'ROUND', action: `Round ${round}: Did not win (myRandom=${MISState.myRandom} <= maxNeighbor=${maxNeighborVal}).` });
  }

  return MISState.candidateSet;
}

async function startMIS() {
  if (MISState.running) {
    logMISEvent({ node: myNodeID, phase: 'START', action: 'Already running' });
    return;
  }
  
  MISState.running = true;
  logMISEvent({ node: myNodeID, phase: 'START', action: 'Starting Luby MIS algorithm' });

  try {
    const MAX_ROUNDS = 10; // Prevent infinite loops
    
    while (MISState.currentRound < MAX_ROUNDS) {
      if (!MISState.candidateSet) {
        // Not a candidate anymore, but wait to see if others are still running
        await new Promise(r => setTimeout(r, 1000));
        
        // Check if we should continue based on network activity
        if (MISState.currentRound > 0) {
          logMISEvent({ node: myNodeID, phase: 'WAIT', action: `Not candidate, waiting for round ${MISState.currentRound + 1}` });
          
          // Reset for potential next round if neighbors are still candidates
          const neighbors = graph.getNeighborIPPort(myNodeID);
          if (neighbors && Array.isArray(neighbors.IPArray) && neighbors.IPArray.length > 0) {
            // Check if any neighbor might still be a candidate
            const hasNonMISNeighbor = neighbors.IPArray.some(() => true); // Simplified check
            if (!hasNonMISNeighbor && MISState.currentRound >= 3) break; // Stop after reasonable rounds
          }
        }
        
        // Continue to next round to see if we become candidate again
        MISState.currentRound++;
        continue;
      }
      
      const cont = await runOneRound();
      if (!cont && !MISState.candidateSet) {
        // This node is done, but others might continue
        await new Promise(r => setTimeout(r, 500));
      }
      
      await new Promise(r => setTimeout(r, 800)); // Longer delay between rounds
    }
    
    // Record final result if not already recorded
    if (!misResults.some(r => r.node === myNodeID)) {
      misResults.push({
        node: myNodeID,
        round: MISState.currentRound,
        inMIS: MISState.inMIS,
        randomValue: MISState.myRandom,
        timestamp: new Date().toISOString()
      });
    }
    
    logMISEvent({ node: myNodeID, phase: 'COMPLETE', action: `Terminated after ${MISState.currentRound} rounds. inMIS=${MISState.inMIS}. localMIS=${Array.from(MISState.localMIS).join(', ')}` });
  } catch (err) {
    logMISEvent({ node: myNodeID, phase: 'ERROR', action: `Error in MIS loop: ${err.message}` });
  } finally {
    MISState.running = false;
  }
}

function broadcastMessage(type, data) {
  const neighbors = graph.getNeighborIPPort(myNodeID);
  if (!neighbors || !Array.isArray(neighbors.IPArray) || neighbors.IPArray.length === 0) {
    return; // No neighbors to broadcast to
  }
  
  const ips = neighbors.IPArray;
  const ports = neighbors.PortArray;
  const endpoints = ports.map(() => 'api/mis');
  const msgObj = { type, sender: myNodeID, data };
  broadcastNew.sendPostRequestsToIPs(msgObj, ips, ports, endpoints);
}

function getMISNodeLog() {
  return misLog;
}

function getMISResults() {
  return misResults;
}

function getMISStatus() {
  return {
    nodeID: myNodeID,
    candidateSet: MISState.candidateSet,
    inMIS: MISState.inMIS,
    currentRound: MISState.currentRound,
    localMIS: Array.from(MISState.localMIS),
    running: MISState.running,
    terminated: !MISState.running && MISState.currentRound > 0
  };
}

module.exports = {
  setNodeContext,
  handleMISMessage,
  startMIS,
  getMISNodeLog,
  getMISResults,
  getMISStatus
};