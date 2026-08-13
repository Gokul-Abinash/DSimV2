const graphlib = require('graphlib');
const os = require('os');

// Graph constructor
const { Graph } = graphlib;
// Undirected graph for full-mesh communication
const graph = new Graph({ directed: false });

// 4 Machines x 16 Nodes per machine = 64 Nodes
const MACHINES = [
  { ip: "10.0.1.11", startNode: 1, endNode: 16 },
  { ip: "10.0.1.12", startNode: 17, endNode: 32 },
  { ip: "10.0.1.13", startNode: 33, endNode: 48 },
  { ip: "10.0.1.14", startNode: 49, endNode: 64 }
];

const BASE_PORT = 3001;
const PORTS_PER_MACHINE = 16;

// Node metadata with IP and Port
const nodeIPsArray = [];

MACHINES.forEach(machine => {
  for (let i = machine.startNode; i <= machine.endNode; i++) {
    const nodeName = `Node${i}`;
    const portOffset = (i - machine.startNode);
    const port = BASE_PORT + portOffset;
    const isSource = (i === 1); // Node1 is the default primary / source

    graph.setNode(nodeName, { ip: machine.ip, port, source: isSource });
    nodeIPsArray.push({
      [nodeName]: { ip: machine.ip, port, source: isSource }
    });
  }
});

// Full Mesh Topology: Set edges between all pairs of nodes
const allNodeNames = nodeIPsArray.map(obj => Object.keys(obj)[0]);
for (let i = 0; i < allNodeNames.length; i++) {
  for (let j = i + 1; j < allNodeNames.length; j++) {
    graph.setEdge(allNodeNames[i], allNodeNames[j]);
  }
}

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

// Get local IPv4 address of the EC2 instance
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

// Find node matching the local AWS private IP and Port
function findCurrentNode(port) {
  const myIP = getLocalIP();
  const targetPort = port ? Number(port) : null;

  for (const node of graph.nodes()) {
    const nodeData = graph.node(node);
    if (nodeData.ip === myIP) {
      if (!targetPort || Number(nodeData.port) === targetPort) {
        return node;
      }
    }
  }
  return null;
}

// Find node by port fallback
function findCurrentNodeByPORT(PORT) {
  if (typeof PORT === 'string') PORT = Number(PORT);

  for (const node of graph.nodes()) {
    const nodePort = graph.node(node).port;
    if (Number(nodePort) === PORT) {
      return node;
    }
  }
  return null;
}

module.exports = {
  MACHINES,
  BASE_PORT,
  PORTS_PER_MACHINE,
  nodeIPsArray,
  graph,
  getNeighborIPPort,
  isIPBelongToNode,
  getLocalIP,
  findCurrentNode,
  findCurrentNodeByPORT
};