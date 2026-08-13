const http = require('http');

// Persistent HTTP Agent with Keep-Alive to eliminate socket exhaustion across 128 nodes
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 2000,
  maxFreeSockets: 512,
  timeout: 10000
});

let latencyConfig = null;
try {
  latencyConfig = require('../../../latency-config.js');
} catch (e) {}

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
    const toNode = getNodeByPort(port);
    
    let delayMs = 0;
    if (latencyConfig && typeof latencyConfig.generateLatency === 'function') {
      let byzantineBehavior = null;
      try {
        const byzantineConfig = require('../byzantine-config.js');
        byzantineBehavior = byzantineConfig[fromNode];
      } catch (error) {}

      const latency = latencyConfig.generateLatency(fromNode, toNode, byzantineBehavior);
      if (latency === -1) continue; // dropped
      delayMs = latencyConfig.addJitter ? latencyConfig.addJitter(latency, 15) : latency;
    }
    
    sendSingleRequest(ip, port, endpoint, bodyStr, delayMs);
  }
}

// Helper function to determine node by port
function getNodeByPort(port) {
  const portMap = {
    3001: 'A', 3002: 'B', 3003: 'C', 3004: 'D',
    3005: 'E', 3006: 'F', 3007: 'G', 3008: 'H'
  };
  return portMap[port] || 'Unknown';
}

// Batch message sending with different latency patterns
async function sendBatchWithLatencyPattern(messages, pattern = 'sequential') {
  switch (pattern) {
    case 'sequential':
      // Send messages one after another
      for (const msg of messages) {
        await sendPostRequestsToIPs(msg.data, msg.ips, msg.ports, msg.endpoints, msg.fromNode);
      }
      break;
      
    case 'parallel':
      // Send all messages simultaneously (default behavior)
      const promises = messages.map(msg => 
        sendPostRequestsToIPs(msg.data, msg.ips, msg.ports, msg.endpoints, msg.fromNode)
      );
      await Promise.all(promises);
      break;
      
    case 'staggered':
      // Send messages with increasing delays
      const staggerDelay = 100; // 100ms between each batch
      for (let i = 0; i < messages.length; i++) {
        setTimeout(() => {
          sendPostRequestsToIPs(messages[i].data, messages[i].ips, 
                               messages[i].ports, messages[i].endpoints, messages[i].fromNode);
        }, i * staggerDelay);
      }
      break;
  }
}

// Network partition simulation
function simulateNetworkPartition(nodeGroups, partitionDuration = 5000) {
  console.log(`[PARTITION] Simulating network partition for ${partitionDuration}ms`);
  
  // Store original latency profile
  const originalProfile = latencyConfig.getLatencyStats().profile;
  
  // Set extremely high latency between partitioned groups
  latencyConfig.setLatencyProfile('custom', {
    min: 999999, max: 999999, distribution: 'fixed'
  });
  
  // Restore network after partition duration
  setTimeout(() => {
    latencyConfig.setLatencyProfile(originalProfile);
    console.log('[PARTITION] Network partition ended');
  }, partitionDuration);
}

// Create unique list from responses (existing function)
function createUniqueListFromResponses(arrayOfObjects) {
  const dataArray = arrayOfObjects.map(obj => obj.data);
  const flattenedArray = dataArray.flat();
  const uniqueSet = new Set(flattenedArray);
  return [...uniqueSet];
}

module.exports = {
  sendPostRequestsToIPs,
  sendBatchWithLatencyPattern,
  simulateNetworkPartition,
  createUniqueListFromResponses
};