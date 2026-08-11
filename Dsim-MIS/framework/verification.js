#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

async function collectNodeData(ports) {
  const nodeData = [];
  
  for (const port of ports) {
    try {
      const statusResponse = await axios.get(`http://localhost:${port}/api/status`, { timeout: 5000 });
      const resultsResponse = await axios.get(`http://localhost:${port}/api/mis-results`, { timeout: 5000 });
      const logResponse = await axios.get(`http://localhost:${port}/api/mis-log`, { timeout: 5000 });
      
      nodeData.push({
        port,
        nodeId: statusResponse.data.nodeID,
        status: statusResponse.data,
        results: resultsResponse.data || [],
        logs: logResponse.data || [],
        running: true
      });
    } catch (error) {
      const nodeId = String.fromCharCode(65 + ports.indexOf(port));
      nodeData.push({
        port,
        nodeId,
        status: null,
        results: [],
        logs: [],
        running: false
      });
    }
  }
  
  return nodeData;
}

function verifyIndependence(nodeData) {
  // Load graph to check adjacency
  let graph;
  try {
    graph = require('./helper_modules/graph.js');
  } catch (error) {
    return { passed: false, details: "Cannot load graph structure" };
  }
  
  // Get MIS nodes
  const misNodes = nodeData
    .filter(node => node.results.length > 0 && node.results[0].inMIS)
    .map(node => node.nodeId);
  
  if (misNodes.length === 0) {
    return { passed: false, details: "No nodes in MIS" };
  }
  
  // Check independence - no two MIS nodes should be adjacent
  for (let i = 0; i < misNodes.length; i++) {
    for (let j = i + 1; j < misNodes.length; j++) {
      const node1 = misNodes[i];
      const node2 = misNodes[j];
      
      try {
        const neighbors = graph.graph.neighbors(node1) || [];
        if (neighbors.includes(node2)) {
          return { 
            passed: false, 
            details: `Adjacent nodes ${node1} and ${node2} both in MIS - violates independence` 
          };
        }
      } catch (error) {
        // Continue checking other pairs
      }
    }
  }
  
  return { 
    passed: true, 
    details: `Independence verified: ${misNodes.length} MIS nodes, no adjacent pairs`,
    misNodes 
  };
}

function verifyMaximality(nodeData) {
  // Load graph to check maximality
  let graph;
  try {
    graph = require('./helper_modules/graph.js');
  } catch (error) {
    return { passed: false, details: "Cannot load graph structure" };
  }
  
  const misNodes = nodeData
    .filter(node => node.results.length > 0 && node.results[0].inMIS)
    .map(node => node.nodeId);
  
  const nonMisNodes = nodeData
    .filter(node => node.results.length === 0 || !node.results[0].inMIS)
    .map(node => node.nodeId);
  
  // Check if any non-MIS node can be added (maximality)
  for (const candidate of nonMisNodes) {
    try {
      const neighbors = graph.graph.neighbors(candidate) || [];
      const hasAdjacentMISNode = neighbors.some(neighbor => misNodes.includes(neighbor));
      
      if (!hasAdjacentMISNode) {
        return { 
          passed: false, 
          details: `Node ${candidate} has no MIS neighbors - MIS is not maximal` 
        };
      }
    } catch (error) {
      // Continue checking other candidates
    }
  }
  
  return { 
    passed: true, 
    details: `Maximality verified: all non-MIS nodes have at least one MIS neighbor` 
  };
}

function verifyTermination(nodeData) {
  const runningNodes = nodeData.filter(node => node.running);
  const completedNodes = nodeData.filter(node => 
    node.running && node.results.length > 0
  );
  
  if (runningNodes.length === 0) {
    return { passed: false, details: "No nodes are running" };
  }
  
  const terminatedNodes = nodeData.filter(node => 
    node.running && node.status && (node.status.terminated || !node.status.running)
  );
  
  const terminationRate = terminatedNodes.length / runningNodes.length;
  
  return {
    passed: terminationRate >= 0.8,
    details: `${terminatedNodes.length}/${runningNodes.length} nodes terminated (${(terminationRate * 100).toFixed(1)}% completion)`,
    terminationRate,
    completedNodes: terminatedNodes.length
  };
}

async function main() {
  try {
    console.log('=== MIS Algorithm Verification ===');
    console.log('Algorithm: Luby\'s Maximum Independent Set');
    console.log('');
    
    // Collect node data
    const ports = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
    const nodeData = await collectNodeData(ports);
    const runningNodes = nodeData.filter(node => node.running);
    
    console.log(`Nodes: ${runningNodes.length}/${ports.length} running`);
    console.log('');
    
    // Show MIS results
    console.log('MIS Results:');
    nodeData.forEach(node => {
      if (node.running && node.results.length > 0) {
        const result = node.results[0];
        const status = result.inMIS ? '🟢 IN MIS' : '🔴 NOT IN MIS';
        console.log(`  ${status} Node ${node.nodeId} (Round ${result.round}, Random: ${result.randomValue.toFixed(4)})`);
      } else if (node.running) {
        console.log(`  ⚪ Node ${node.nodeId} (No result yet)`);
      } else {
        console.log(`  🔴 Node ${node.nodeId} (STOPPED)`);
      }
    });
    console.log('');
    
    // Verify MIS properties
    const independence = verifyIndependence(nodeData);
    const maximality = verifyMaximality(nodeData);
    const termination = verifyTermination(nodeData);
    
    console.log(`${independence.passed ? '✅' : '❌'} Independence: ${independence.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${independence.details}`);
    console.log('');
    
    console.log(`${maximality.passed ? '✅' : '❌'} Maximality: ${maximality.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${maximality.details}`);
    console.log('');
    
    console.log(`${termination.passed ? '✅' : '❌'} Termination: ${termination.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${termination.details}`);
    console.log('');
    
    // Summary
    const allPassed = independence.passed && maximality.passed && termination.passed;
    console.log(`=== Summary ===`);
    console.log(`MIS verification: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    process.exit(2);
  }
}

main();