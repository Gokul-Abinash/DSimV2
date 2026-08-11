// Byzantine Corrupt Protocol - Corrupts messages and values
const HonestProtocol = require('../protocol.js');

const CorruptProtocol = {
  ...HonestProtocol,
  
  handleClientRequest(request, myNodeID) {
    // Corrupt client requests randomly
    if (Math.random() < 0.3) { // 30% chance to corrupt
      const originalValue = request.value;
      request.value = Math.floor(Math.random() * 9999);
      console.log(`[${myNodeID}] BYZANTINE: Corrupted request value ${originalValue} -> ${request.value}`);
    }
    return HonestProtocol.handleClientRequest(request, myNodeID);
  },
  
  handlePBFTMessage(msg, myNodeID) {
    // Corrupt message data
    if (msg.type === 'PRE-PREPARE' && Math.random() < 0.4) {
      if (msg.data && msg.data.request) {
        const originalValue = msg.data.request.value;
        msg.data.request.value = Math.floor(Math.random() * 9999);
        console.log(`[${myNodeID}] BYZANTINE: Corrupted PRE-PREPARE value ${originalValue} -> ${msg.data.request.value}`);
      }
    }
    
    // Send conflicting PREPARE messages
    if (msg.type === 'PREPARE' && Math.random() < 0.2) {
      console.log(`[${myNodeID}] BYZANTINE: Sending conflicting PREPARE message`);
      // Create conflicting message with different digest
      const conflictMsg = {
        ...msg,
        data: {
          ...msg.data,
          digest: 'corrupted_digest_' + Math.random()
        }
      };
      // Process both original and conflicting message
      HonestProtocol.handlePBFTMessage(conflictMsg, myNodeID);
    }
    
    return HonestProtocol.handlePBFTMessage(msg, myNodeID);
  }
};

module.exports = CorruptProtocol;