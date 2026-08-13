#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const graph = require('./helper_modules/graph.js');

async function collectNodeData() {
  const nodeData = [];
  const nodes = graph.nodeIPsArray;
  
  console.log(`Querying ${nodes.length} nodes across cluster...`);
  
  for (const nodeObj of nodes) {
    const nodeId = Object.keys(nodeObj)[0];
    const { ip, port } = nodeObj[nodeId];
    
    try {
      const statusResponse = await axios.get(`http://${ip}:${port}/api/status`, { timeout: 3000 });
      const resultsResponse = await axios.get(`http://${ip}:${port}/api/mis-results`, { timeout: 3000 });
      const logResponse = await axios.get(`http://${ip}:${port}/api/mis-log`, { timeout: 3000 });
      
      nodeData.push({
        port,
        ip,
        nodeId: statusResponse.data.nodeID || nodeId,
        status: statusResponse.data,
        results: resultsResponse.data || [],
        logs: logResponse.data || [],
        running: true
      });
    } catch (error) {
      nodeData.push({
        port,
        ip,
        nodeId,
        status: null,
        results: [],
        logs: [],
        running: false,
        error: error.message
      });
    }
  }
  
  return nodeData;
}

function verifyIndependence(nodeData) {
  // Get MIS nodes
  const misNodes = nodeData
    .filter(node => node.running && node.results.length > 0 && node.results[0].inMIS)
    .map(node => node.nodeId);
  
  if (misNodes.length === 0) {
    return { passed: false, details: "No nodes in MIS" };
  }
  
  // Check independence - in full mesh, MIS must have size 1; in general graph, no two MIS nodes are adjacent
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
        // Continue checking
      }
    }
  }
  
  return { 
    passed: true, 
    details: `Independence verified: ${misNodes.length} MIS node(s) [${misNodes.join(', ')}], no adjacent pairs`,
    misNodes 
  };
}

function verifyMaximality(nodeData) {
  const misNodes = nodeData
    .filter(node => node.running && node.results.length > 0 && node.results[0].inMIS)
    .map(node => node.nodeId);
  
  const nonMisNodes = nodeData
    .filter(node => node.running && (node.results.length === 0 || !node.results[0].inMIS))
    .map(node => node.nodeId);
  
  if (misNodes.length === 0) {
    return { passed: false, details: "Cannot verify maximality: MIS is empty" };
  }
  
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
      // Continue checking
    }
  }
  
  return { 
    passed: true, 
    details: `Maximality verified: all ${nonMisNodes.length} non-MIS nodes have at least one MIS neighbor` 
  };
}

function verifyTermination(nodeData) {
  const runningNodes = nodeData.filter(node => node.running);
  
  if (runningNodes.length === 0) {
    return { passed: false, details: "No nodes are running" };
  }
  
  const completedNodes = nodeData.filter(node => 
    node.running && node.results.length > 0
  );
  
  const terminationRate = completedNodes.length / runningNodes.length;
  
  return {
    passed: terminationRate >= 0.8,
    details: `${completedNodes.length}/${runningNodes.length} nodes terminated (${(terminationRate * 100).toFixed(1)}% completion)`,
    terminationRate,
    completedNodes: completedNodes.length
  };
}

async function main() {
  try {
    console.log('=== MIS Algorithm Verification ===');
    console.log('Algorithm: Luby\'s Maximum Independent Set');
    console.log('');
    
    const nodeData = await collectNodeData();
    const runningNodes = nodeData.filter(node => node.running);
    
    // Per-server breakdown
    console.log('\n--- Per-Server Node Health Breakdown ---');
    for (const machine of graph.MACHINES) {
      const serverNodes = nodeData.filter(n => n.ip === machine.ip);
      const onlineCount = serverNodes.filter(n => n.running).length;
      const totalCount = serverNodes.length;
      const statusIcon = onlineCount === totalCount ? '✅' : '⚠️ ';
      console.log(`${statusIcon} Server ${machine.ip}: ${onlineCount}/${totalCount} nodes online`);
      if (onlineCount < totalCount) {
        const offline = serverNodes.filter(n => !n.running).map(n => `${n.nodeId}:${n.port}`).join(', ');
        console.log(`   Offline: ${offline}`);
      }
    }
    
    console.log(`\nCluster Status: ${runningNodes.length}/${nodeData.length} nodes running`);
    console.log('');
    
    // Show sample MIS results
    console.log('Sample MIS Results:');
    nodeData.slice(0, 16).forEach(node => {
      if (node.running && node.results.length > 0) {
        const result = node.results[0];
        const status = result.inMIS ? '🟢 IN MIS' : '⚪ NOT IN MIS';
        console.log(`  ${status} ${node.nodeId} (${node.ip}:${node.port}) - Round ${result.round}, Random: ${(result.randomValue || 0).toFixed(4)}`);
      } else if (node.running) {
        console.log(`  ⚪ ${node.nodeId} (No result yet)`);
      } else {
        console.log(`  🔴 ${node.nodeId} (STOPPED)`);
      }
    });
    if (nodeData.length > 16) {
      console.log(`  ... and ${nodeData.length - 16} more nodes`);
    }
    console.log('');
    
    // Verify MIS properties
    const independence = verifyIndependence(nodeData);
    const maximality = verifyMaximality(nodeData);
    const termination = verifyTermination(nodeData);
    
    console.log('MIS Properties:');
    console.log(`${independence.passed ? '✅' : '❌'} Independence: ${independence.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${independence.details}`);
    console.log('');
    
    console.log(`${maximality.passed ? '✅' : '❌'} Maximality: ${maximality.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${maximality.details}`);
    console.log('');
    
    console.log(`${termination.passed ? '✅' : '❌'} Termination: ${termination.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${termination.details}`);
    console.log('');
    
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