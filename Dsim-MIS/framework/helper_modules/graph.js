const graphlib = require('graphlib');
const os = require('os');

// Graph constructor
const { Graph } = graphlib;
// Undirected graph
const graph = new Graph({ directed: false });

// Auto-generated topology: 8 nodes, full topology
// Deployment: localhost (All nodes on localhost (development/testing))

// Nodes
graph.setNode('Node1');
graph.setNode('Node2');
graph.setNode('Node3');
graph.setNode('Node4');
graph.setNode('Node5');
graph.setNode('Node6');
graph.setNode('Node7');
graph.setNode('Node8');

// Edges
graph.setEdge('Node1', 'Node2');
graph.setEdge('Node1', 'Node3');
graph.setEdge('Node1', 'Node4');
graph.setEdge('Node1', 'Node5');
graph.setEdge('Node1', 'Node6');
graph.setEdge('Node1', 'Node7');
graph.setEdge('Node1', 'Node8');
graph.setEdge('Node2', 'Node3');
graph.setEdge('Node2', 'Node4');
graph.setEdge('Node2', 'Node5');
graph.setEdge('Node2', 'Node6');
graph.setEdge('Node2', 'Node7');
graph.setEdge('Node2', 'Node8');
graph.setEdge('Node3', 'Node4');
graph.setEdge('Node3', 'Node5');
graph.setEdge('Node3', 'Node6');
graph.setEdge('Node3', 'Node7');
graph.setEdge('Node3', 'Node8');
graph.setEdge('Node4', 'Node5');
graph.setEdge('Node4', 'Node6');
graph.setEdge('Node4', 'Node7');
graph.setEdge('Node4', 'Node8');
graph.setEdge('Node5', 'Node6');
graph.setEdge('Node5', 'Node7');
graph.setEdge('Node5', 'Node8');
graph.setEdge('Node6', 'Node7');
graph.setEdge('Node6', 'Node8');
graph.setEdge('Node7', 'Node8');

// Node metadata with IP and Port
const nodeIPsArray = [
  { 'Node1': { ip: "127.0.0.1", port: 3001, source: true } },
  { 'Node2': { ip: "127.0.0.1", port: 3002, source: false } },
  { 'Node3': { ip: "127.0.0.1", port: 3003, source: false } },
  { 'Node4': { ip: "127.0.0.1", port: 3004, source: false } },
  { 'Node5': { ip: "127.0.0.1", port: 3005, source: false } },
  { 'Node6': { ip: "127.0.0.1", port: 3006, source: false } },
  { 'Node7': { ip: "127.0.0.1", port: 3007, source: false } },
  { 'Node8': { ip: "127.0.0.1", port: 3008, source: false } }
];

// Assign metadata
nodeIPsArray.forEach(nodeObj => {
  const nodeName = Object.keys(nodeObj)[0];
  const { ip, port, source } = nodeObj[nodeName];
  graph.setNode(nodeName, { ip, port, source });
});

// Get neighbor IPs and ports
function getNeighborIPPort(nodeName) {
  if (!nodeName || nodeName === -1) {
    console.warn('Please check the node name passed to getNeighborIPPort');
    return 'Please check the node name passed';
  }

  const neighbors = graph.neighbors(nodeName);

  if (!neighbors || neighbors.length === 0) {
    return `Node ${nodeName} has no neighbors.`;
  }

  let IPArray = [];
  let PortArray = [];

  neighbors.forEach(neighbor => {
    const neighborData = graph.node(neighbor);
    if (neighborData) {
      IPArray.push(neighborData.ip);
      PortArray.push(neighborData.port);
    } else {
      console.warn(`No metadata found for neighbor node ${neighbor}`);
    }
  });

  return { IPArray, PortArray };
}

// Check if IP belongs to a node
function isIPBelongToNode(ipAddress) {
  const nodes = graph.nodes();
  for (const node of nodes) {
    const nodeIP = graph.node(node).ip;
    if (nodeIP === ipAddress) {
      return node;
    }
  }
  return -1;
}

// Get local IPv4 address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

// Find node by local IP
function findCurrentNode() {
  const myIP = getLocalIP();
  for (const node of graph.nodes()) {
    if (graph.node(node).ip === myIP) {
      return node;
    }
  }
  return "check your ip current address matching ip in graph node";
}

// Find node by port (coerces port to number)
function findCurrentNodeByPORT(PORT) {
  if (typeof PORT === 'string') PORT = Number(PORT);

  for (const node of graph.nodes()) {
    const nodePort = graph.node(node).port;
    if (Number(nodePort) === PORT) {
      return node;
    }
  }
  return "check your ip current address matching ip in graph node";
}

module.exports = {
  nodeIPsArray,
  graph,
  getNeighborIPPort,
  isIPBelongToNode,
  getLocalIP,
  findCurrentNode,
  findCurrentNodeByPORT
};