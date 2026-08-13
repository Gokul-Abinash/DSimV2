const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const graph = require('./helper_modules/graph.js');
const protocol = require('./protocol.js');

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
app.use(express.static(__dirname));

const explicitNodeID = process.argv[3];
const myNodeID = explicitNodeID || graph.findCurrentNode(PORT) || graph.findCurrentNodeByPORT(PORT);

if (!myNodeID) {
  console.error(`Could not determine Node ID for PORT=${PORT} on local IP=${graph.getLocalIP()}`);
  process.exit(1);
}

protocol.setNodeContext(myNodeID);
console.log(`HotStuff Node started at ID=${myNodeID}, IP=${graph.getLocalIP()}, PORT=${PORT}`);

// View status
app.get('/', (req, res) => {
  res.send(`Node ${myNodeID}, Port ${PORT} - HotStuff ready`);
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
    status: "HotStuff node ready", 
    nodeID: myNodeID, 
    port: PORT,
    behavior: behavior,
    isByzantine: behavior !== 'honest',
    byzantineType: behavior !== 'honest' ? behavior : null
  });
});

// HotStuff message endpoint
app.post('/api/hotstuff', (req, res) => {
  protocol.handleHotStuffMessage(req.body, myNodeID);
  res.json({ ok: true });
});

// Log viewing routes
app.get('/api/hotstuff-log', (req, res) => {
  res.json(protocol.getHotStuffNodeLog());
});

app.get('/api/hotstuff-commit-log', (req, res) => {
  res.json(protocol.getHotStuffCommitLog());
});

// Client request endpoint
app.post('/api/client', (req, res) => {
  protocol.handleClientRequest(req.body, myNodeID);
  console.log(req.body);
  res.json({ ok: true, msg: "Request handled" });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;