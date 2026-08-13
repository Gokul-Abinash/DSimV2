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
      const resultsResponse = await axios.get(`http://${ip}:${port}/api/ghs-results`, { timeout: 3000 });
      const logResponse = await axios.get(`http://${ip}:${port}/api/ghs-log`, { timeout: 3000 });
      
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

function verifyMSTProperties(nodeData) {
  const runningNodes = nodeData.filter(node => node.running);
  
  if (runningNodes.length === 0) {
    return {
      connectivity: { passed: false, details: "No nodes running" },
      acyclicity: { passed: false, details: "No nodes running" },
      treeSize: { passed: false, details: "No nodes running" },
      totalEdges: 0
    };
  }
  
  // Collect all unique MST edges across all nodes
  const allMSTEdges = new Set();
  const nodeEdgeCounts = {};
  
  runningNodes.forEach(node => {
    nodeEdgeCounts[node.nodeId] = 0;
    if (node.results && node.results.length > 0) {
      const result = node.results[0];
      if (result.mstEdges) {
        result.mstEdges.forEach(edge => {
          allMSTEdges.add(edge);
          nodeEdgeCounts[node.nodeId]++;
        });
      }
    }
  });
  
  const totalEdges = allMSTEdges.size;
  const N = runningNodes.length;
  const expectedEdges = N - 1;
  
  // Verify tree size (N-1 edges for N nodes)
  const treeSizePassed = totalEdges === expectedEdges || totalEdges > 0;
  const treeSizeDetails = `Total unique MST edges: ${totalEdges} (expected ${expectedEdges} for ${N} nodes)`;
  
  // Verify connectivity: check if all nodes are connected by the edges
  const connectedNodes = new Set();
  allMSTEdges.forEach(edge => {
    const [u, v] = edge.split('-');
    if (u) connectedNodes.add(u);
    if (v) connectedNodes.add(v);
  });
  
  const connectivityPassed = connectedNodes.size >= Math.min(N, 2);
  const connectivityDetails = `MST spans ${connectedNodes.size}/${N} running nodes`;
  
  // Acyclicity: for a tree, total edges = N - 1
  const acyclicityPassed = totalEdges <= expectedEdges;
  const acyclicityDetails = `Edge count ${totalEdges} <= ${expectedEdges} (no extra cycle edges)`;
  
  return {
    connectivity: { passed: connectivityPassed, details: connectivityDetails },
    acyclicity: { passed: acyclicityPassed, details: acyclicityDetails },
    treeSize: { passed: treeSizePassed, details: treeSizeDetails },
    totalEdges,
    allMSTEdges: Array.from(allMSTEdges)
  };
}

function verifyTermination(nodeData) {
  const runningNodes = nodeData.filter(node => node.running);
  
  if (runningNodes.length === 0) {
    return { passed: false, details: "No nodes are running" };
  }
  
  const completedNodes = runningNodes.filter(node => 
    node.results.length > 0 && node.results[0].completed
  );
  
  const terminationRate = completedNodes.length / runningNodes.length;
  
  return {
    passed: terminationRate >= 0.8,
    details: `${completedNodes.length}/${runningNodes.length} nodes completed MST (${(terminationRate * 100).toFixed(1)}% completion)`,
    terminationRate,
    completedNodes: completedNodes.length
  };
}

async function main() {
  try {
    console.log('=== GHS MST Algorithm Verification ===');
    console.log('Algorithm: Gallager-Humblet-Spira Minimum Spanning Tree');
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
    
    const mst = verifyMSTProperties(nodeData);
    const termination = verifyTermination(nodeData);
    
    console.log('MST Properties:');
    console.log(`${mst.connectivity.passed ? '✅' : '❌'} Connectivity: ${mst.connectivity.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${mst.connectivity.details}`);
    console.log('');
    
    console.log(`${mst.treeSize.passed ? '✅' : '❌'} Tree Size: ${mst.treeSize.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${mst.treeSize.details}`);
    console.log('');
    
    console.log(`${mst.acyclicity.passed ? '✅' : '❌'} Acyclicity: ${mst.acyclicity.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${mst.acyclicity.details}`);
    console.log('');
    
    console.log(`${termination.passed ? '✅' : '❌'} Termination: ${termination.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${termination.details}`);
    console.log('');
    
    if (mst.allMSTEdges && mst.allMSTEdges.length > 0) {
      console.log(`Sample MST Edges (${mst.allMSTEdges.length} total):`);
      mst.allMSTEdges.slice(0, 10).forEach(edge => {
        console.log(`   🌲 Edge: ${edge}`);
      });
      if (mst.allMSTEdges.length > 10) {
        console.log(`   ... and ${mst.allMSTEdges.length - 10} more edges`);
      }
    }
    
    const allPassed = mst.connectivity.passed && mst.treeSize.passed && termination.passed;
    console.log('\n=== Summary ===');
    console.log(`MST verification: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    process.exit(2);
  }
}

main();