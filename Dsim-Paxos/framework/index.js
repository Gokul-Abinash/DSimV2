const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const graph = require('./helper_modules/graph.js');
const protocolLoader = require('./protocol-loader.js');

const app = express();
app.use(bodyParser.json());

const PORT = Number(process.argv[2]);
if (!PORT) {
  console.error("Provide a PORT: node index.js 3001");
  process.exit(1);
}
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));   // to handle the html pages


const myNodeID = graph.findCurrentNodeByPORT(PORT);
const protocol = protocolLoader.loadProtocol(myNodeID);
protocol.setNodeContext(myNodeID);
console.log(`Paxos Node started at ID=${myNodeID}, PORT=${PORT}`);

// Setting the Paxos protocol context
protocol.setNodeContext(myNodeID);

// View status
app.get('/', (req, res) => {
  res.send(`Node ${myNodeID}, Port ${PORT} - Paxos ready`);
});
app.get('/api/status', (req, res) => {
  // Load Byzantine configuration to determine node behavior
  let behavior = 'honest';
  let byzantineConfig = {};
  
  try {
    byzantineConfig = require('./byzantine-config.js');
    behavior = byzantineConfig[myNodeID] || 'honest';
  } catch (error) {
    // No Byzantine config file exists
  }
  
  res.json({ 
    status: "Paxos node ready", 
    nodeID: myNodeID, 
    port: PORT,
    behavior: behavior,
    isByzantine: behavior !== 'honest',
    byzantineType: behavior !== 'honest' ? behavior : null
  });
});

// Paxos message endpoint
app.post('/api/paxos', (req, res) => {
  protocol.handlePaxosMessage(req.body, myNodeID);
  res.json({ ok: true });
});

// Keep PBFT endpoint for compatibility
app.post('/api/pbft', (req, res) => {
  protocol.handlePaxosMessage(req.body, myNodeID);
  res.json({ ok: true });
});


// Paxos log viewing routes:
app.get('/api/paxos-log', (req, res) => {
  res.json(protocol.getPaxosNodeLog());
});

// Keep PBFT endpoint for compatibility
app.get('/api/pbft-log', (req, res) => {
  res.json(protocol.getPaxosNodeLog());
});

// Paxos Commit Log
app.get('/api/paxos-commit-log', (req, res) => {
  res.json(protocol.getPaxosCommitLog());
});

// Keep PBFT endpoint for compatibility
app.get('/api/pbft-commit-log', (req, res) => {
  res.json(protocol.getPaxosCommitLog());
});

// To simulate: client triggers consensus by POSTing to this node's /api/client
app.post('/api/client', (req, res) => {
  protocol.handleClientRequest(req.body, myNodeID);
  console.log(req.body);
  res.json({ ok: true, msg: "Request handled" });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

