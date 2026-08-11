// Byzantine Delay Protocol - Introduces strategic delays
const HonestProtocol = require('../protocol.js');

const DelayProtocol = {
  ...HonestProtocol,
  
  handleClientRequest(request, myNodeID) {
    // Random delay for client requests
    const delay = Math.floor(Math.random() * 2000) + 500; // 500-2500ms delay
    console.log(`[${myNodeID}] BYZANTINE: Delaying client request by ${delay}ms`);
    
    setTimeout(() => {
      HonestProtocol.handleClientRequest(request, myNodeID);
    }, delay);
  },
  
  handlePBFTMessage(msg, myNodeID) {
    // Strategic delays based on message type
    let delay = 0;
    
    switch (msg.type) {
      case 'PRE-PREPARE':
        delay = Math.floor(Math.random() * 1000) + 200; // 200-1200ms
        break;
      case 'PREPARE':
        delay = Math.floor(Math.random() * 800) + 100; // 100-900ms
        break;
      case 'COMMIT':
        delay = Math.floor(Math.random() * 1500) + 300; // 300-1800ms
        break;
      default:
        delay = Math.floor(Math.random() * 500); // 0-500ms
    }
    
    if (delay > 0) {
      console.log(`[${myNodeID}] BYZANTINE: Delaying ${msg.type} message by ${delay}ms`);
      setTimeout(() => {
        HonestProtocol.handlePBFTMessage(msg, myNodeID);
      }, delay);
    } else {
      return HonestProtocol.handlePBFTMessage(msg, myNodeID);
    }
  }
};

module.exports = DelayProtocol;