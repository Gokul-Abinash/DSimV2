const {generateKeyPair} = require('./cryptoHelper');
['A', 'B' , 'C', 'D', 'E', 'F', 'G', 'H'].forEach(generateKeyPair);
console.log('Keys generated for nodes A, B, C, D, E, F, G, H');