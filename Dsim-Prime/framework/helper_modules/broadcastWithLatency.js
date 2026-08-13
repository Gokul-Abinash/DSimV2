const axios = require('axios');
const http = require('http');

// Persistent HTTP Agent with Keep-Alive to eliminate socket exhaustion across 128 nodes
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 500,
  maxFreeSockets: 100,
  timeout: 15000
});

const apiClient = axios.create({
  httpAgent,
  timeout: 10000
});

let latencyConfig = null;
try {
  latencyConfig = require('../../../latency-config.js');
} catch (e) {}

// Message queue for delayed delivery
const messageQueue = [];
let messageId = 0;

async function sendPostRequestsToIPs(postData, ipsArray, portArray, endpointArray, fromNode = null) {
  const responses = [];
  
  try {
    const promises = ipsArray.map(async (ip, index) => {
      const port = portArray[index];
      const endpoint = endpointArray[index];
      const url = `http://${ip}:${port}/${endpoint}`;
      
      // Determine target node for latency calculation
      const toNode = getNodeByPort(port);
      
      // Check for Byzantine behavior
      let byzantineBehavior = null;
      try {
        const byzantineConfig = require('../byzantine-config.js');
        byzantineBehavior = byzantineConfig[fromNode];
      } catch (error) {
        // No Byzantine config
      }
      
      let finalLatency = 0;
      if (latencyConfig && typeof latencyConfig.generateLatency === 'function') {
        const latency = latencyConfig.generateLatency(fromNode, toNode, byzantineBehavior);
        if (latency === -1) {
          responses.push({ ip, data: null, error: 'Message dropped by Byzantine behavior' });
          return;
        }
        finalLatency = latencyConfig.addJitter ? latencyConfig.addJitter(latency, 15) : latency;
      }
      
      try {
        if (finalLatency > 0) {
          await new Promise(resolve => setTimeout(resolve, finalLatency));
        }
        
        const response = await apiClient.post(url, postData, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        responses.push({ ip, data: response.data, error: null, latency: finalLatency });
      } catch (error) {
        responses.push({ ip, data: null, error: error.message, latency: finalLatency });
      }
    });

    await Promise.all(promises);
    
    // Log results
    responses.forEach(result => {
      if (result.error && result.error !== 'Message dropped by Byzantine behavior') {
        console.error(`[NETWORK] Error to ${result.ip}:`, result.error);
      }
    });
    
  } catch (error) {
    console.error('[NETWORK] General Error:', error.message);
  }

  return responses;
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