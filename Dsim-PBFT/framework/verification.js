#!/usr/bin/env node

// Consensus Verification Tool
const fs = require('fs');
const axios = require('axios');

async function collectNodeData(ports) {
  const nodeData = [];
  
  for (const port of ports) {
    try {
      const commitResponse = await axios.get(`http://localhost:${port}/api/pbft-commit-log`, { timeout: 5000 });
      const logResponse = await axios.get(`http://localhost:${port}/api/pbft-log`, { timeout: 5000 });
      
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

function loadByzantineConfig() {
  try {
    const config = require('./byzantine-config.js');
    return config;
  } catch (error) {
    return {}; // No Byzantine nodes
  }
}

function filterHonestNodes(nodeData, byzantineConfig) {
  return nodeData.filter(node => {
    const behavior = byzantineConfig[node.nodeId];
    return !behavior || behavior === 'honest';
  });
}

function verifyAgreement(honestNodes, testData) {
  if (honestNodes.length === 0) {
    return { passed: false, details: "No honest nodes found" };
  }
  
  // Extract commit sequences from honest nodes (compare values only)
  const commitSequences = honestNodes.map(node => 
    node.commits.slice(-testData.count).map(tx => tx.value)
  );
  
  // Find minimum sequence length to compare common prefix
  const minLength = Math.min(...commitSequences.map(seq => seq.length));
  
  if (minLength === 0) {
    return { passed: false, details: "No transactions committed by honest nodes" };
  }
  
  // Compare common prefix of all sequences
  const commonPrefixes = commitSequences.map(seq => seq.slice(0, minLength));
  const referencePrefix = JSON.stringify(commonPrefixes[0]);
  const identical = commonPrefixes.every(prefix => 
    JSON.stringify(prefix) === referencePrefix
  );
  
  const completionCounts = commitSequences.map(seq => seq.length);
  const allComplete = completionCounts.every(count => count === testData.count);
  
  return {
    passed: identical,
    details: identical 
      ? `All ${honestNodes.length} honest nodes have identical transaction order${allComplete ? '' : ` (comparing first ${minLength} transactions)`}`
      : `Disagreement found among ${honestNodes.length} honest nodes in transaction order`
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
  
  // Check each node's recent commits
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

function verifyTermination(honestNodes, expectedCount) {
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
    console.log('=== Consensus Verification ===');
    
    // Load test metadata
    const testData = loadTestMetadata();
    console.log(`Algorithm: PBFT`);
    console.log(`Test: ${testData.count} transactions [${testData.submittedValues.join(', ')}]`);
    console.log('');
    
    // Load Byzantine configuration
    const byzantineConfig = loadByzantineConfig();
    const byzantineNodes = Object.keys(byzantineConfig).filter(node => 
      byzantineConfig[node] !== 'honest'
    );
    
    if (byzantineNodes.length > 0) {
      console.log(`Byzantine nodes detected: ${byzantineNodes.join(', ')}`);
    }
    
    // Collect node data - dynamically determine port range
    const nodeCount = Object.keys(byzantineConfig).length || 4;
    const ports = Array.from({length: nodeCount}, (_, i) => 3001 + i);
    const nodeData = await collectNodeData(ports);
    const runningNodes = nodeData.filter(node => node.status === 'running');
    const honestNodes = filterHonestNodes(runningNodes, byzantineConfig);
    
    console.log(`Nodes: ${runningNodes.length}/${ports.length} running, ${honestNodes.length} honest`);
    console.log('');
    
    // Verify consensus properties
    const agreement = verifyAgreement(honestNodes, testData);
    const validity = verifyValidity(runningNodes, testData.submittedValues);
    const termination = verifyTermination(honestNodes, testData.count);
    
    // Display results with detailed values
    console.log(`${agreement.passed ? '✅' : '❌'} Agreement: ${agreement.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${agreement.details}`);
    
    // Show all node states
    console.log(`   Node commit sequences:`);
    nodeData.forEach(node => {
      const values = node.commits.slice(-testData.count).map(tx => tx.value);
      const behavior = byzantineConfig[node.nodeId] || 'honest';
      const status = node.status === 'running' ? '🟢' : '🔴';
      console.log(`     ${status} Node ${node.nodeId} (${behavior}): [${values.join(', ')}]`);
    });
    console.log('');
    
    console.log(`${validity.passed ? '✅' : '❌'} Validity: ${validity.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${validity.details}`);
    console.log(`   Submitted: [${validity.submitted.join(', ')}]`);
    
    if (validity.passed) {
      console.log(`   All honest nodes committed valid values (Byzantine nodes excluded)`);
    } else {
      console.log(`   Invalid commits found in honest nodes:`);
      validity.nodeResults.forEach(result => {
        if (result.isHonest && result.hasInvalidCommits) {
          console.log(`     ❌ Node ${result.nodeId}: [${result.invalidValues.join(', ')}]`);
        }
      });
    }
    console.log('');
    
    console.log(`${termination.passed ? '✅' : '❌'} Termination: ${termination.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${termination.details}`);
    console.log('');
    
    // Summary
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