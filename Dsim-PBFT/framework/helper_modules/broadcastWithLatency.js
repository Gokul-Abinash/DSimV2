const axios = require('axios');

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
        
        const response = await axios.post(url, postData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000 // 8 second timeout for cross-server HTTP requests
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