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
  timeout: 8000
});

// Safe loading of latency-config if present
let latencyConfig = null;
try {
  latencyConfig = require('../../../latency-config.js');
} catch (e) {
  // Standalone deployment - no latency simulator
}

async function sendPostRequestsToIPs(postData, ipsArray, portArray, endpointArray, fromNode = null) {
  const responses = [];
  
  try {
    const promises = ipsArray.map(async (ip, index) => {
      const port = portArray[index];
      const endpoint = endpointArray[index];
      const url = `http://${ip}:${port}/${endpoint}`;
      
      let delayMs = 0;
      
      // If latency simulation is active
      if (latencyConfig && typeof latencyConfig.generateLatency === 'function') {
        let byzantineBehavior = null;
        try {
          const byzantineConfig = require('../byzantine-config.js');
          byzantineBehavior = byzantineConfig[fromNode];
        } catch (error) {}

        const latency = latencyConfig.generateLatency(fromNode, `Port${port}`, byzantineBehavior);
        
        // Handle message dropping
        if (latency === -1) {
          responses.push({ ip, port, data: null, error: 'Message dropped by Byzantine behavior' });
          return;
        }
        
        delayMs = latencyConfig.addJitter ? latencyConfig.addJitter(latency, 15) : latency;
      }
      
      try {
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const response = await apiClient.post(url, postData, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        responses.push({ ip, port, data: response.data, error: null });
      } catch (error) {
        responses.push({ ip, port, data: null, error: error.message });
      }
    });

    await Promise.all(promises);
    
  } catch (error) {
    console.error('[NETWORK] Broadcast Error:', error.message);
  }

  return responses;
}

// Helper to create unique list
function createUniqueListFromResponses(arrayOfObjects) {
  const dataArray = arrayOfObjects.map(obj => obj.data).filter(Boolean);
  const flattenedArray = dataArray.flat();
  const uniqueSet = new Set(flattenedArray);
  return [...uniqueSet];
}

module.exports = {
  sendPostRequestsToIPs,
  createUniqueListFromResponses
};