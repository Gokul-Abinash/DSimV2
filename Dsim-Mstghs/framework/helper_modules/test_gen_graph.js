const graphlib = require('graphlib');
const Graph = graphlib.Graph;

// Example input: number of nodes and adjacency list
const nodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const adjacencyList = {
  'A': ['B', 'C', 'D', 'E', 'F', 'G', 'H'],
  'B': ['A', 'C', 'D', 'E', 'F', 'G', 'H'],
  'C': ['A', 'B', 'D', 'E', 'F', 'G', 'H'],
  'D': ['A', 'B', 'C', 'E', 'F', 'G', 'H'],
  'E': ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
  'F': ['A', 'B', 'C', 'D', 'E', 'G', 'H'],
  'G': ['A', 'B', 'C', 'D', 'E', 'F', 'H'],
  'H': ['A', 'B', 'C', 'D', 'E', 'F', 'H']
};


//---------complete graph of 3 nodes-------
// const nodes = ['A', 'B', 'C'];
// const adjacencyList = {
//   'A': ['B', 'C'],
//   'B': ['A', 'C'],
//   'C': ['A', 'B']
// };

//------------------------------------------



const baseIP = "127.0.0.1";
const basePort = 3001;

// Create a new undirected graph
const graph = new Graph({ directed: false });

console.log('// Nodes');
nodes.forEach(node => {
  graph.setNode(node);
  console.log(`graph.setNode('${node}');`);
});

// Track added edges to avoid duplicates (e.g., (A,B) and (B,A))
const addedEdges = new Set();

console.log('\n// Edges');
for (const [node, neighbors] of Object.entries(adjacencyList)) {
  neighbors.forEach(neighbor => {
    const edgeKey = [node, neighbor].sort().join('-'); // e.g., A-B
    if (!addedEdges.has(edgeKey)) {
      graph.setEdge(node, neighbor);
      console.log(`graph.setEdge('${node}', '${neighbor}');`);
      addedEdges.add(edgeKey);
    }
  });
}

// Node metadata
console.log('\n// Node metadata with IP and Port');
const nodeIPsArray = nodes.map((node, index) => {
  return {
    [node]: {
      ip: baseIP,
      port: basePort + index,
      source: index === 0 // first node is source
    }
  };
});

console.log('const nodeIPsArray = [');
nodeIPsArray.forEach(entry => {
  const [node] = Object.keys(entry);
  const { ip, port, source } = entry[node];
  console.log(`  { '${node}': { ip: "${ip}", port: ${port}, source: ${source} } },`);
});
console.log('];');
