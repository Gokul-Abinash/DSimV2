const protocol = require('./protocol.js');

function loadProtocol(nodeID) {
  return protocol;
}

module.exports = {
  loadProtocol
};