const graph = require('./helper_modules/graph.js');
const broadcastNew = require('./helper_modules/broadcastNew.js');

const ENABLE_LOGGING = true;
const ghsLog = [];
const mstResults = [];

function timestamp() {
  const date = new Date();
  return date.toLocaleTimeString() + "." + date.getMilliseconds();
}

function logGHSEvent(event) {
  ghsLog.push({ ...event, timestamp: new Date().toISOString() });
  if (ENABLE_LOGGING) {
    console.log(`[${timestamp()}]`, event.node, "-", event.phase, "-", event.action, event.details ? JSON.stringify(event.details) : "");
  }
}

// Simplified MST State
const MSTState = {
  nodeId: null,
  edgeWeights: new Map(),
  mstEdges: new Set(),
  running: false,
  completed: false
};

let myNodeID;
let globalMSTEdges = new Set(); // Shared MST edges

function setNodeContext(nodeID) {
  myNodeID = nodeID;
  MSTState.nodeId = nodeID;
  MSTState.mstEdges.clear();
  MSTState.edgeWeights.clear();
  
  // Initialize consistent edge weights
  const neighbors = graph.graph.neighbors(nodeID) || [];
  neighbors.forEach((neighbor) => {
    const edge = [nodeID, neighbor].sort().join('-');
    const weight = Math.abs(edge.charCodeAt(0) + edge.charCodeAt(2)) % 9 + 1;
    MSTState.edgeWeights.set(neighbor, weight);
    logGHSEvent({ node: myNodeID, phase: 'INIT', action: `Edge ${edge} weight: ${weight}` });
  });
  
  logGHSEvent({ node: myNodeID, phase: 'INIT', action: 'Node initialized for MST' });
}

function handleGHSMessage(msg, nodeID) {
  const { type, sender, data } = msg;
  
  switch (type) {
    case 'MST_EDGE':
      onMSTEdge(data, sender);
      break;
    case 'MST_COMPLETE':
      onMSTComplete(data, sender);
      break;
  }
}

function onMSTEdge(data, sender) {
  const { edge, weight } = data;
  globalMSTEdges.add(edge);
  logGHSEvent({ node: myNodeID, phase: 'MST_EDGE', action: `Received MST edge: ${edge} weight: ${weight}` });
}

function onMSTComplete(data, sender) {
  MSTState.completed = true;
  logGHSEvent({ node: myNodeID, phase: 'COMPLETE', action: `MST completion signal from ${sender}` });
}

async function startGHS(inputWeights = null) {
  if (MSTState.running) {
    logGHSEvent({ node: myNodeID, phase: 'START', action: 'Already running' });
    return;
  }
  
  MSTState.running = true;
  logGHSEvent({ node: myNodeID, phase: 'START', action: 'Starting simplified MST algorithm' });

  try {
    // Use Kruskal's algorithm approach - collect all edges and sort by weight
    const allEdges = [];
    const allNodes = graph.graph.nodes();
    const totalNodes = allNodes.length;
    
    // Collect all edges with weights (only from lexicographically smaller node to avoid duplicates)
    allNodes.forEach(nodeA => {
      const neighbors = graph.graph.neighbors(nodeA) || [];
      neighbors.forEach(nodeB => {
        if (nodeA < nodeB) { // Only add edge once
          const edge = `${nodeA}-${nodeB}`;
          const weight = Math.abs(edge.charCodeAt(0) + edge.charCodeAt(2)) % 9 + 1;
          allEdges.push({ edge, weight, nodeA, nodeB });
        }
      });
    });
    
    // Sort edges by weight
    allEdges.sort((a, b) => a.weight - b.weight);
    
    logGHSEvent({ node: myNodeID, phase: 'KRUSKAL', action: `Total edges: ${allEdges.length}, need ${totalNodes-1} for MST` });
    
    // Use Union-Find to detect cycles and build MST
    const parent = {};
    const rank = {};
    
    // Initialize Union-Find
    allNodes.forEach(node => {
      parent[node] = node;
      rank[node] = 0;
    });
    
    function find(x) {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    }
    
    function union(x, y) {
      const rootX = find(x);
      const rootY = find(y);
      
      if (rootX !== rootY) {
        if (rank[rootX] < rank[rootY]) {
          parent[rootX] = rootY;
        } else if (rank[rootX] > rank[rootY]) {
          parent[rootY] = rootX;
        } else {
          parent[rootY] = rootX;
          rank[rootX]++;
        }
        return true;
      }
      return false;
    }
    
    // Build MST using Kruskal's algorithm
    const mstEdges = [];
    let edgeCount = 0;
    
    for (const edgeInfo of allEdges) {
      if (edgeCount >= totalNodes - 1) break; // MST complete
      
      const { edge, weight, nodeA, nodeB } = edgeInfo;
      
      if (union(nodeA, nodeB)) {
        mstEdges.push({ edge, weight });
        edgeCount++;
        
        logGHSEvent({ node: myNodeID, phase: 'MST_BUILD', action: `Added edge ${edge} weight: ${weight} (${edgeCount}/${totalNodes-1})` });
        
        // If this node is involved in the edge, add it to local MST
        if (nodeA === myNodeID || nodeB === myNodeID) {
          MSTState.mstEdges.add(edge);
        }
      }
    }
    
    // Wait for algorithm completion
    await new Promise(r => setTimeout(r, 5000));
    
    // Record final result
    const edgeDetails = [];
    mstEdges.forEach(({ edge, weight }) => {
      const [nodeA, nodeB] = edge.split('-');
      if (nodeA === myNodeID || nodeB === myNodeID) {
        edgeDetails.push({ edge, weight: weight.toString() });
      }
    });
    
    mstResults.push({
      node: myNodeID,
      level: 1,
      fragmentId: 'MST',
      mstEdges: Array.from(MSTState.mstEdges),
      edgeDetails: edgeDetails,
      totalWeight: edgeDetails.reduce((sum, e) => sum + parseInt(e.weight), 0),
      timestamp: new Date().toISOString(),
      completed: true
    });
    
    logGHSEvent({ node: myNodeID, phase: 'COMPLETE', action: `MST completed. Edges: ${edgeDetails.length}` });
  } catch (err) {
    logGHSEvent({ node: myNodeID, phase: 'ERROR', action: `Error in MST: ${err.message}` });
  } finally {
    MSTState.running = false;
    MSTState.completed = true;
  }
}

function getGHSNodeLog() {
  return ghsLog;
}

function getGHSResults() {
  return mstResults;
}

function getGHSStatus() {
  return {
    nodeID: myNodeID,
    mstEdges: Array.from(MSTState.mstEdges),
    running: MSTState.running,
    terminated: MSTState.completed
  };
}

module.exports = {
  setNodeContext,
  handleGHSMessage,
  startGHS,
  getGHSNodeLog,
  getGHSResults,
  getGHSStatus
};