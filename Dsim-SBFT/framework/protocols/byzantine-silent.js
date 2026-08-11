// Byzantine Silent Protocol - Simulates crash/silent failures
const HonestProtocol = require('../protocol.js');

// Override functions to simulate silent behavior
const SilentProtocol = {
  ...HonestProtocol,
  
  // Silent nodes stop responding after a certain number of messages
  messageCount: 0,
  maxMessages: Math.floor(Math.random() * 20) + 10, // Random between 10-30 messages
  
  handleClientRequest(request, myNodeID) {
    this.messageCount++;
    if (this.messageCount > this.maxMessages) {
      console.log(`[${myNodeID}] BYZANTINE: Going silent after ${this.messageCount} messages`);
      return; // Stop processing
    }
    return HonestProtocol.handleClientRequest(request, myNodeID);
  },
  
  handlePBFTMessage(msg, myNodeID) {
    this.messageCount++;
    if (this.messageCount > this.maxMessages) {
      console.log(`[${myNodeID}] BYZANTINE: Ignoring message (silent mode)`);
      return; // Stop processing messages
    }
    return HonestProtocol.handlePBFTMessage(msg, myNodeID);
  }
};

module.exports = SilentProtocol;