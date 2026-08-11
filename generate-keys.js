#!/usr/bin/env node

// Generate crypto keys for numeric node IDs (Node1, Node2, etc.)
const cryptoHelper = require('./Dsim-Pbft/framework/helper_modules/cryptoHelper.js');
const fs = require('fs');
const path = require('path');

const maxNodes = 100;

console.log(`Generating crypto keys for Node1 to Node${maxNodes}...`);

// Generate keys for all algorithms
const algorithms = ['Pbft', 'Sbft', 'Hotstuff', 'Prime', 'Paxos', 'Raft', 'Mis', 'Mstghs'];

algorithms.forEach(algo => {
  const keyDir = path.join(__dirname, `Dsim-${algo}`, 'framework', 'helper_modules');
  
  if (fs.existsSync(keyDir)) {
    console.log(`Generating keys for ${algo}...`);
    
    for (let i = 1; i <= maxNodes; i++) {
      const nodeID = `Node${i}`;
      try {
        cryptoHelper.generateKeyPair(nodeID);
        
        // Copy keys to the algorithm directory
        const privateKeyPath = path.join(__dirname, 'Dsim-Pbft', 'framework', 'helper_modules', `${nodeID}_private.pem`);
        const publicKeyPath = path.join(__dirname, 'Dsim-Pbft', 'framework', 'helper_modules', `${nodeID}_public.pem`);
        
        if (fs.existsSync(privateKeyPath) && algo !== 'Pbft') {
          fs.copyFileSync(privateKeyPath, path.join(keyDir, `${nodeID}_private.pem`));
          fs.copyFileSync(publicKeyPath, path.join(keyDir, `${nodeID}_public.pem`));
        }
      } catch (error) {
        console.error(`Failed to generate keys for ${nodeID} in ${algo}:`, error.message);
      }
    }
  }
});

console.log('✅ Key generation completed!');