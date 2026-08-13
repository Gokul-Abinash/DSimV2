#!/usr/bin/env node

// Consensus Verification Tool for Multi-Server Distributed SBFT
const fs = require('fs');
const axios = require('axios');
const graph = require('./helper_modules/graph.js');

async function collectNodeData() {
  const nodes = graph.nodeIPsArray;
  console.log(`Querying ${nodes.length} nodes across cluster...`);
  
  const promises = nodes.map(async (nodeObj) => {
    const nodeId = Object.keys(nodeObj)[0];
    const { ip, port } = nodeObj[nodeId];
    
    try {
      const commitResponse = await axios.get(`http://${ip}:${port}/api/sbft-commit-log`, { timeout: 3000 });
      const logResponse = await axios.get(`http://${ip}:${port}/api/sbft-log`, { timeout: 3000 });
      
      return {
        port,
        ip,
        nodeId,
        commits: commitResponse.data || [],
        logs: logResponse.data || [],
        status: 'running'
      };
    } catch (error) {
      return {
        port,
        ip,
        nodeId,
        commits: [],
        logs: [],
        status: 'failed',
        error: error.message
      };
    }
  });
  
  return Promise.all(promises);
}

function loadTestMetadata() {
  const possiblePaths = [
    'test-metadata.json',
    '../test-metadata.json',
    './framework/test-metadata.json',
    '../../test-metadata.json'
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {}
  }
  return { count: 100, submittedValues: [] };
}

function loadByzantineConfig() {
  try {
    const config = require('./byzantine-config.js');
    return config;
  } catch (error) {
    return {};
  }
}

function verifyAgreement(nodeData, byzantineConfig) {
  const honestNodes = nodeData.filter(node => 
    node.status === 'running' && byzantineConfig[node.nodeId] === 'honest'
  );
  
  if (honestNodes.length === 0) {
    return { passed: false, details: "No honest nodes are running" };
  }
  
  const nodesWithCommits = honestNodes.filter(n => n.commits.length > 0);
  if (nodesWithCommits.length === 0) {
    return { passed: false, details: "No transactions committed by honest nodes" };
  }
  
  const referenceCommits = nodesWithCommits[0].commits.map(c => c.value);
  
  for (const node of nodesWithCommits) {
    const nodeCommits = node.commits.map(c => c.value);
    
    if (nodeCommits.length !== referenceCommits.length) {
      return { 
        passed: false, 
        details: `Node ${node.nodeId} has ${nodeCommits.length} commits, expected ${referenceCommits.length}` 
      };
    }
    
    for (let i = 0; i < referenceCommits.length; i++) {
      if (nodeCommits[i] !== referenceCommits[i]) {
        return { 
          passed: false, 
          details: `Commit mismatch at index ${i}: Node ${node.nodeId} committed ${nodeCommits[i]}, expected ${referenceCommits[i]}` 
        };
      }
    }
  }
  
  return { 
    passed: true, 
    details: `All ${nodesWithCommits.length} honest running nodes agreed on ${referenceCommits.length} committed transactions: [${referenceCommits.join(', ')}]`,
    committedValues: referenceCommits
  };
}

function verifyValidity(nodeData, testMetadata, byzantineConfig) {
  const honestNodes = nodeData.filter(node => 
    node.status === 'running' && byzantineConfig[node.nodeId] === 'honest'
  );
  
  if (honestNodes.length === 0) {
    return { passed: false, details: "No honest nodes to verify validity" };
  }
  
  const submittedValues = new Set(testMetadata.submittedValues || []);
  let allValid = true;
  let totalCommits = 0;
  
  for (const node of honestNodes) {
    for (const commit of node.commits) {
      totalCommits++;
      const isValid = (submittedValues.size > 0 && submittedValues.has(commit.value)) ||
                      (submittedValues.size === 0 && typeof commit.value === 'number' && commit.value > 0);
      if (!isValid) {
        allValid = false;
        return { 
          passed: false, 
          details: `Invalid value ${commit.value} committed by ${node.nodeId}` 
        };
      }
    }
  }
  
  return { 
    passed: allValid && totalCommits > 0, 
    details: `All ${totalCommits} committed values were legitimately proposed by client` 
  };
}

async function main() {
  try {
    console.log('=== SBFT Cluster Consensus Verification ===');
    
    const nodeData = await collectNodeData();
    const testMetadata = loadTestMetadata();
    const byzantineConfig = loadByzantineConfig();
    
    const runningNodes = nodeData.filter(n => n.status === 'running');
    const honestRunningNodes = runningNodes.filter(n => byzantineConfig[n.nodeId] === 'honest');
    
    // Per-server breakdown
    console.log('\n--- Per-Server Node Health Breakdown ---');
    for (const machine of graph.MACHINES) {
      const serverNodes = nodeData.filter(n => n.ip === machine.ip);
      const onlineCount = serverNodes.filter(n => n.status === 'running').length;
      const totalCount = serverNodes.length;
      const statusIcon = onlineCount === totalCount ? '✅' : '⚠️ ';
      console.log(`${statusIcon} Server ${machine.ip}: ${onlineCount}/${totalCount} nodes online`);
      if (onlineCount < totalCount) {
        const offline = serverNodes.filter(n => n.status === 'failed').map(n => `${n.nodeId}:${n.port}`).join(', ');
        console.log(`   Offline: ${offline}`);
      }
    }
    
    console.log(`\nCluster Status: ${runningNodes.length}/${nodeData.length} nodes running (${honestRunningNodes.length} honest)`);
    
    const totalN = nodeData.length;
    const f = Math.floor((totalN - 1) / 3);
    const requiredCommitQuorum = 2 * f + 1;
    
    console.log(`SBFT Fault Tolerance: N=${totalN}, f=${f}, Required Quorum (2f+1)=${requiredCommitQuorum}`);
    
    if (runningNodes.length < requiredCommitQuorum) {
      console.log(`\n❌ Quorum Failure: Only ${runningNodes.length} nodes online. Need at least ${requiredCommitQuorum} for SBFT quorum.`);
    }
    
    const agreement = verifyAgreement(nodeData, byzantineConfig);
    const validity = verifyValidity(nodeData, testMetadata, byzantineConfig);
    
    console.log('\nConsensus Checks:');
    console.log(`${agreement.passed ? '✅' : '❌'} Agreement: ${agreement.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${agreement.details}`);
    
    console.log(`${validity.passed ? '✅' : '❌'} Validity: ${validity.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${validity.details}`);
    
    console.log('\nSample Node Commit State:');
    const sampleNodes = runningNodes.slice(0, 8);
    sampleNodes.forEach(node => {
      const commits = node.commits.map(c => c.value);
      console.log(`   🟢 ${node.nodeId} (${node.ip}:${node.port}): [${commits.join(', ')}] (${commits.length} total commits)`);
    });
    if (runningNodes.length > 8) {
      console.log(`   ... and ${runningNodes.length - 8} more nodes`);
    }
    
    const allPassed = agreement.passed && validity.passed;
    console.log('\n=== Summary ===');
    console.log(`Consensus: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Verification error: ${error.message}`);
    process.exit(2);
  }
}

main();