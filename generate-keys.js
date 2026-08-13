#!/usr/bin/env node

// Generate crypto keys for numeric node IDs (Node1, Node2, etc.)
const cryptoHelper = require('./Dsim-PBFT/framework/helper_modules/cryptoHelper.js');
const fs = require('fs');
const path = require('path');

const maxNodes = 128;

console.log(`Generating crypto keys for Node1 to Node${maxNodes}...`);

// Generate keys for all algorithms
const algorithms = ['PBFT', 'SBFT', 'HotStuff', 'Prime', 'Paxos', 'Raft', 'MIS', 'Mstghs'];

algorithms.forEach(algo => {
  const keyDir = path.join(__dirname, `Dsim-${algo}`, 'framework', 'helper_modules');
  
  if (fs.existsSync(keyDir)) {
    console.log(`Generating keys for ${algo}...`);
    
    for (let i = 1; i <= maxNodes; i++) {
      const nodeID = `Node${i}`;
      try {
        const privateKeyPath = path.join(keyDir, `${nodeID}_private.pem`);
        const publicKeyPath = path.join(keyDir, `${nodeID}_public.pem`);
        
        if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
          cryptoHelper.generateKeyPair(nodeID);
          const pbftPrivate = path.join(__dirname, 'Dsim-PBFT', 'framework', 'helper_modules', `${nodeID}_private.pem`);
          const pbftPublic = path.join(__dirname, 'Dsim-PBFT', 'framework', 'helper_modules', `${nodeID}_public.pem`);
          
          if (algo !== 'PBFT' && fs.existsSync(pbftPrivate)) {
            fs.copyFileSync(pbftPrivate, privateKeyPath);
            fs.copyFileSync(pbftPublic, publicKeyPath);
          }
        }
      } catch (error) {
        console.error(`Failed to generate keys for ${nodeID} in ${algo}:`, error.message);
      }
    }
  }
});

console.log('✅ Key generation completed!');