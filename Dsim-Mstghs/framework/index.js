const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const graph = require('./helper_modules/graph.js');
const protocolLoader = require('./protocol-loader.js');

const app = express();

const PORT = Number(process.argv[2]);
if (!PORT) {
  console.error("Provide a PORT: node index.js 3001");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const myNodeID = graph.findCurrentNodeByPORT(PORT);
const protocol = protocolLoader.loadProtocol(myNodeID);
protocol.setNodeContext(myNodeID);
console.log(`GHS Node started at ID=${myNodeID}, PORT=${PORT}`);

// View status
app.get('/', (req, res) => {
  res.send(`Node ${myNodeID}, Port ${PORT} - GHS MST ready`);
});

app.get('/api/status', (req, res) => {
  const status = protocol.getGHSStatus();
  res.json({ 
    status: "GHS node ready", 
    nodeID: myNodeID, 
    port: PORT,
    algorithm: "GHS MST",
    ...status
  });
});

// GHS message endpoint
app.post('/api/ghs', (req, res) => {
  protocol.handleGHSMessage(req.body, myNodeID);
  res.json({ ok: true });
});

// GHS log viewing routes
app.get('/api/ghs-log', (req, res) => {
  res.json(protocol.getGHSNodeLog());
});

app.get('/api/ghs-results', (req, res) => {
  res.json(protocol.getGHSResults());
});

// Start GHS algorithm endpoint
app.post('/api/start-ghs', (req, res) => {
  const weights = req.body.weights || null;
  protocol.startGHS(weights);
  res.json({ ok: true, msg: "GHS algorithm started", weights: weights ? "custom" : "default" });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});