// Byzantine Random Protocol - Random malicious behavior
const HonestProtocol = require('../protocol.js');

const RandomProtocol = {
  ...HonestProtocol,
  
  handleClientRequest(request, myNodeID) {
    const behavior = Math.random();
    
    if (behavior < 0.2) {
      // 20% chance: Ignore request
      console.log(`[${myNodeID}] BYZANTINE: Ignoring client request`);
      return;
    } else if (behavior < 0.4) {
      // 20% chance: Corrupt request
      request.value = Math.floor(Math.random() * 9999);
      console.log(`[${myNodeID}] BYZANTINE: Corrupted client request`);
    } else if (behavior < 0.6) {
      // 20% chance: Delay request
      const delay = Math.floor(Math.random() * 1000) + 200;
      console.log(`[${myNodeID}] BYZANTINE: Delaying client request by ${delay}ms`);
      setTimeout(() => {
        HonestProtocol.handleClientRequest(request, myNodeID);
      }, delay);
      return;
    }
    // 40% chance: Process normally
    
    return HonestProtocol.handleClientRequest(request, myNodeID);
  },
  
  handlePBFTMessage(msg, myNodeID) {
    const behavior = Math.random();
    
    if (behavior < 0.15) {
      // 15% chance: Ignore message
      console.log(`[${myNodeID}] BYZANTINE: Ignoring ${msg.type} message`);
      return;
    } else if (behavior < 0.25) {
      // 10% chance: Corrupt message
      if (msg.data && msg.data.request) {
        msg.data.request.value = Math.floor(Math.random() * 9999);
        console.log(`[${myNodeID}] BYZANTINE: Corrupted ${msg.type} message`);
      }
    } else if (behavior < 0.35) {
      // 10% chance: Delay message
      const delay = Math.floor(Math.random() * 800) + 100;
      console.log(`[${myNodeID}] BYZANTINE: Delaying ${msg.type} message by ${delay}ms`);
      setTimeout(() => {
        HonestProtocol.handlePBFTMessage(msg, myNodeID);
      }, delay);
      return;
    } else if (behavior < 0.4) {
      // 5% chance: Send duplicate message
      console.log(`[${myNodeID}] BYZANTINE: Sending duplicate ${msg.type} message`);
      HonestProtocol.handlePBFTMessage(msg, myNodeID);
      setTimeout(() => {
        HonestProtocol.handlePBFTMessage(msg, myNodeID);
      }, 100);
      return;
    }
    // 60% chance: Process normally
    
    return HonestProtocol.handlePBFTMessage(msg, myNodeID);
  }
};

module.exports = RandomProtocol;