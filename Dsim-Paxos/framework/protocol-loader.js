// Protocol Loader - Dynamically loads protocol based on node behavior
const fs = require('fs');
const path = require('path');

function loadProtocol(nodeID) {
  try {
    // Try to load Byzantine configuration
    const byzantineConfig = require('./byzantine-config.js');
    const behavior = byzantineConfig[nodeID] || 'honest';
    
    console.log(`[${nodeID}] Loading ${behavior} protocol`);
    
    // Load appropriate protocol implementation
    switch (behavior) {
      case 'silent':
        return require('./protocols/byzantine-silent.js');
      case 'corrupt':
        return require('./protocols/byzantine-corrupt.js');
      case 'delay':
        return require('./protocols/byzantine-delay.js');
      case 'random':
        return require('./protocols/byzantine-random.js');
      case 'honest':
      default:
        return require('./protocol.js');
    }
  } catch (error) {
    // If no Byzantine config exists, use honest protocol
    console.log(`[${nodeID}] Loading honest protocol (no Byzantine config)`);
    return require('./protocol.js');
  }
}

module.exports = {
  loadProtocol
};