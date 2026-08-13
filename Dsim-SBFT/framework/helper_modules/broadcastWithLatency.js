const http = require('http');

// Persistent HTTP Agent with Keep-Alive to eliminate socket exhaustion across 128 nodes
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 2000,
  maxFreeSockets: 512,
  timeout: 10000
});

// Safe loading of latency-config if present
let latencyConfig = null;
try {
  latencyConfig = require('../../../latency-config.js');
} catch (e) {
  // Standalone deployment - no latency simulator
}

function sendSingleRequest(ip, port, endpoint, bodyStr, delayMs = 0) {
  if (delayMs > 0) {
    setTimeout(() => sendSingleRequest(ip, port, endpoint, bodyStr, 0), delayMs);
    return;
  }

  const req = http.request({
    hostname: ip,
    port: port,
    path: `/${endpoint}`,
    method: 'POST',
    agent: httpAgent,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    },
    timeout: 5000
  }, (res) => {
    res.resume();
  });

  req.on('error', () => {});
  req.on('timeout', () => {
    req.destroy();
  });

  req.write(bodyStr);
  req.end();
}

function sendPostRequestsToIPs(postData, ipsArray, portArray, endpointArray, fromNode = null) {
  const bodyStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
  
  for (let i = 0; i < ipsArray.length; i++) {
    const ip = ipsArray[i];
    const port = portArray[i];
    const endpoint = endpointArray[i];
    
    let delayMs = 0;
    if (latencyConfig && typeof latencyConfig.generateLatency === 'function') {
      let byzantineBehavior = null;
      try {
        const byzantineConfig = require('../byzantine-config.js');
        byzantineBehavior = byzantineConfig[fromNode];
      } catch (error) {}

      const latency = latencyConfig.generateLatency(fromNode, `Port${port}`, byzantineBehavior);
      if (latency === -1) continue; // Message dropped
      delayMs = latencyConfig.addJitter ? latencyConfig.addJitter(latency, 15) : latency;
    }
    
    sendSingleRequest(ip, port, endpoint, bodyStr, delayMs);
  }
}

// Helper to create unique list
function createUniqueListFromResponses(arrayOfObjects) {
  const dataArray = (arrayOfObjects || []).map(obj => obj && obj.data).filter(Boolean);
  const flattenedArray = dataArray.flat();
  const uniqueSet = new Set(flattenedArray);
  return [...uniqueSet];
}

module.exports = {
  sendPostRequestsToIPs,
  createUniqueListFromResponses
};