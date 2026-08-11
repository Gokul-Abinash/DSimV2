#!/usr/bin/env node

// Paxos Consensus Verification Tool
const fs = require('fs');
const axios = require('axios');

async function collectNodeData(ports) {
  const nodeData = [];
  
  for (const port of ports) {
    try {
      const commitResponse = await axios.get(`http://localhost:${port}/api/paxos-commit-log`, { timeout: 5000 });
      const logResponse = await axios.get(`http://localhost:${port}/api/paxos-log`, { timeout: 5000 });
      
      nodeData.push({
        port,
        nodeId: `Node${ports.indexOf(port) + 1}`, // Node1, Node2, Node3...
        commits: commitResponse.data || [],
        logs: logResponse.data || [],
        status: 'running'
      });
    } catch (error) {
      nodeData.push({
        port,
        nodeId: `Node${ports.indexOf(port) + 1}`,
        commits: [],
        logs: [],
        status: 'failed'
      });
    }
  }
  
  return nodeData;
}

function loadTestMetadata() {
  try {
    const metadata = JSON.parse(fs.readFileSync('test-metadata.json', 'utf8'));
    return metadata;
  } catch (error) {
    throw new Error('No test metadata found. Run test command first.');
  }
}

function verifyAgreement(nodeData) {
  if (nodeData.length === 0) {
    return { passed: false, details: "No nodes found" };
  }
  
  const runningNodes = nodeData.filter(node => node.status === 'running');
  if (runningNodes.length === 0) {
    return { passed: false, details: "No running nodes found" };
  }
  
  // Load Byzantine configuration to identify honest nodes
  let byzantineNodes = [];
  try {
    const byzantineConfig = require('./byzantine-config.js');
    byzantineNodes = Object.keys(byzantineConfig).filter(nodeId => byzantineConfig[nodeId] !== 'honest');
  } catch (error) {
    // No Byzantine config
  }
  
  // Only check agreement among honest nodes
  const honestNodes = runningNodes.filter(node => !byzantineNodes.includes(node.nodeId));
  
  if (honestNodes.length === 0) {
    return { passed: false, details: "No honest nodes found" };
  }
  
  const commitSequences = honestNodes.map(node => 
    node.commits.map(tx => ({ operation: tx.operation, value: tx.value }))
  );
  
  const referenceSequence = JSON.stringify(commitSequences[0]);
  const identical = commitSequences.every(seq => 
    JSON.stringify(seq) === referenceSequence
  );
  
  return {
    passed: identical,
    details: identical 
      ? `All ${honestNodes.length} honest nodes committed identical transactions`
      : `Disagreement found among ${honestNodes.length} honest nodes`
  };
}

function verifyValidity(nodeData, submittedValues) {
  const expectedCount = submittedValues.length;
  
  // Load Byzantine configuration to identify honest nodes
  let byzantineNodes = [];
  try {
    const byzantineConfig = require('./byzantine-config.js');
    byzantineNodes = Object.keys(byzantineConfig).filter(nodeId => byzantineConfig[nodeId] !== 'honest');
  } catch (error) {
    // No Byzantine config
  }
  
  // Only check validity for honest nodes
  const honestNodes = nodeData.filter(node => !byzantineNodes.includes(node.nodeId));
  
  const nodeValidityResults = nodeData.map(node => {
    const isHonest = !byzantineNodes.includes(node.nodeId);
    const recentCommits = node.commits.slice(-expectedCount);
    const committedValues = recentCommits.map(tx => tx.value);
    const invalidValues = isHonest ? committedValues.filter(value => !submittedValues.includes(value)) : [];
    
    return {
      nodeId: node.nodeId,
      committedValues,
      invalidValues,
      hasInvalidCommits: invalidValues.length > 0,
      isHonest
    };
  });
  
  // Only count invalid commits from honest nodes
  const honestInvalidCommits = nodeValidityResults
    .filter(result => result.isHonest)
    .flatMap(result => result.invalidValues);
  
  return {
    passed: honestInvalidCommits.length === 0,
    details: honestInvalidCommits.length === 0
      ? `All recent commits from honest nodes trace to submitted requests (checked last ${expectedCount} commits per node)`
      : `${honestInvalidCommits.length} invalid commits found in honest nodes`,
    submitted: submittedValues,
    nodeResults: nodeValidityResults,
    totalInvalidCommits: honestInvalidCommits.length
  };
}

function verifyTermination(nodeData, expectedCount) {
  const runningNodes = nodeData.filter(node => node.status === 'running');
  if (runningNodes.length === 0) {
    return { passed: false, details: "No running nodes to verify" };
  }
  
  // Load Byzantine configuration to identify honest nodes
  let byzantineNodes = [];
  try {
    const byzantineConfig = require('./byzantine-config.js');
    byzantineNodes = Object.keys(byzantineConfig).filter(nodeId => byzantineConfig[nodeId] !== 'honest');
  } catch (error) {
    // No Byzantine config
  }
  
  // Only check termination among honest nodes
  const honestNodes = runningNodes.filter(node => !byzantineNodes.includes(node.nodeId));
  
  if (honestNodes.length === 0) {
    return { passed: false, details: "No honest nodes to verify" };
  }
  
  const commitCounts = honestNodes.map(node => node.commits.length);
  const completeNodes = commitCounts.filter(count => count >= expectedCount).length;
  const completionRate = completeNodes / honestNodes.length;
  
  return {
    passed: completionRate >= 0.8,
    details: `${completeNodes}/${honestNodes.length} honest nodes completed all transactions (${(completionRate * 100).toFixed(1)}% completion)`,
    completionRate,
    completeNodes,
    expectedCount
  };
}

async function main() {
  try {
    console.log('=== Paxos Consensus Verification ===');
    
    const testData = loadTestMetadata();
    console.log(`Algorithm: Paxos`);
    console.log(`Test: ${testData.count} transactions [${testData.submittedValues.join(', ')}]`);
    console.log('');
    
    // Load Byzantine configuration
    let byzantineNodes = [];
    try {
      const byzantineConfig = require('./byzantine-config.js');
      byzantineNodes = Object.keys(byzantineConfig).filter(nodeId => byzantineConfig[nodeId] !== 'honest');
      if (byzantineNodes.length > 0) {
        console.log(`Byzantine nodes detected: ${byzantineNodes.join(', ')}`);
      }
    } catch (error) {
      // No Byzantine config
    }
    
    // Load actual topology from graph.js
    const graph = require('./helper_modules/graph.js');
    const ports = graph.nodeIPsArray.map(obj => Object.values(obj)[0].port);
    const nodeData = await collectNodeData(ports);
    const runningNodes = nodeData.filter(node => node.status === 'running');
    
    // Load Byzantine configuration to show honest vs total
    let byzantineConfig2 = {};
    let byzantineNodesList = [];
    try {
      byzantineConfig2 = require('./byzantine-config.js');
      byzantineNodesList = Object.keys(byzantineConfig2).filter(nodeId => byzantineConfig2[nodeId] !== 'honest');
    } catch (error) {
      // No Byzantine config
    }
    
    const honestNodes = runningNodes.filter(node => !byzantineNodesList.includes(node.nodeId));
    console.log(`Nodes: ${runningNodes.length}/${ports.length} running, ${honestNodes.length} honest`);
    console.log('');
    
    const agreement = verifyAgreement(nodeData);
    const validity = verifyValidity(runningNodes, testData.submittedValues);
    const termination = verifyTermination(nodeData, testData.count);
    
    // Display results with detailed values
    console.log(`${agreement.passed ? '✅' : '❌'} Agreement: ${agreement.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${agreement.details}`);
    
    console.log(`   Node commit sequences:`);
    nodeData.forEach(node => {
      const values = node.commits.slice(-testData.count).map(tx => tx.value);
      
      // Determine node role/behavior and color
      let role = 'acceptor';
      let status = '🟢'; // Green for honest nodes
      try {
        const byzantineConfig = require('./byzantine-config.js');
        const behavior = byzantineConfig[node.nodeId];
        if (behavior && behavior !== 'honest') {
          role = behavior;
          status = '🔴'; // Red for Byzantine/crash nodes
        }
      } catch (error) {
        // No Byzantine config
      }
      
      console.log(`     ${status} Node ${node.nodeId} (${role}): [${values.join(', ')}]`);
    });
    console.log('');
    
    console.log(`${validity.passed ? '✅' : '❌'} Validity: ${validity.passed ? 'PASS' : 'FAIL'}`);
    if (validity.passed) {
      console.log(`   Honest nodes committed valid values [${validity.submitted.join(', ')}]`);
    } else {
      console.log(`   Invalid commits in honest nodes`);
    }
    console.log('');
    
    console.log(`${termination.passed ? '✅' : '❌'} Termination: ${termination.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${termination.details}`);
    console.log('');
    
    const allPassed = agreement.passed && validity.passed && termination.passed;
    console.log(`=== Summary ===`);
    console.log(`Consensus verification: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    process.exit(2);
  }
}

main();