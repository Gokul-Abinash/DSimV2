const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const graph = require('./helper_modules/graph.js');
const protocolLoader = require('./protocol-loader.js');

const app = express();
app.use(bodyParser.json());

const PORT = Number(process.argv[2]);
if (!PORT) {
  console.error("Provide a PORT: node index.js 3001 [NodeID]");
  process.exit(1);
}
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));   // to handle the html pages

// Determine Node ID: Explicit argument -> IP+Port match -> Port match fallback
const explicitNodeID = process.argv[3];
const myNodeID = explicitNodeID || graph.findCurrentNode(PORT) || graph.findCurrentNodeByPORT(PORT);

if (!myNodeID) {
  console.error(`Could not determine Node ID for PORT=${PORT} on local IP=${graph.getLocalIP()}`);
  process.exit(1);
}

const protocol = protocolLoader.loadProtocol(myNodeID);
protocol.setNodeContext(myNodeID);
console.log(`PBFT Node started at ID=${myNodeID}, IP=${graph.getLocalIP()}, PORT=${PORT}`);

// View status
app.get('/', (req, res) => {
  res.send(`Node ${myNodeID}, Port ${PORT} - PBFT ready`);
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
    status: "PBFT node ready", 
    nodeID: myNodeID, 
    port: PORT,
    behavior: behavior,
    isByzantine: behavior !== 'honest',
    byzantineType: behavior !== 'honest' ? behavior : null
  });
});

// PBFT message endpoint
app.post('/api/pbft', (req, res) => {
  protocol.handlePBFTMessage(req.body, myNodeID);
  res.json({ ok: true });
});

// Add log viewing route:
app.get('/api/pbft-log', (req, res) => {
  res.json(protocol.getPBFTNodeLog());
});

// Adding a PBFT Commit Log
app.get('/api/pbft-commit-log', (req, res) => {
  res.json(protocol.getPBFTCommitLog());
});

// To simulate: client triggers consensus by POSTing to this node's /api/client
app.post('/api/client', (req, res) => {
  protocol.handleClientRequest(req.body, myNodeID);
  console.log(req.body);
  res.json({ ok: true, msg: "Request handled" });
});

// Start server listening on all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
