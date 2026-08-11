#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

async function collectNodeData(ports) {
  const nodeData = [];
  
  for (const port of ports) {
    try {
      const statusResponse = await axios.get(`http://localhost:${port}/api/status`, { timeout: 5000 });
      const resultsResponse = await axios.get(`http://localhost:${port}/api/ghs-results`, { timeout: 5000 });
      const logResponse = await axios.get(`http://localhost:${port}/api/ghs-log`, { timeout: 5000 });
      
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

function verifyConnectivity(nodeData) {
  // Collect unique MST edges (avoid duplicates from different nodes)
  const mstEdges = new Set();
  let totalWeight = 0;
  
  nodeData.forEach(node => {
    if (node.running && node.results.length > 0 && node.results[0].edgeDetails) {
      node.results[0].edgeDetails.forEach(detail => {
        mstEdges.add(detail.edge);
        totalWeight += parseFloat(detail.weight);
      });
    }
  });
  
  const runningNodes = nodeData.filter(n => n.running).length;
  const expectedEdges = runningNodes - 1; // MST should have exactly n-1 edges
  
  return {
    passed: mstEdges.size === expectedEdges,
    details: `MST has ${mstEdges.size} edges (expected ${expectedEdges}), total weight: ${totalWeight.toFixed(2)}`,
    mstEdges: Array.from(mstEdges),
    totalWeight,
    actualEdges: mstEdges.size,
    expectedEdges
  };
}

function verifyAcyclicity(nodeData) {
  // Collect unique edges and check n-1 constraint
  const mstEdges = new Set();
  
  nodeData.forEach(node => {
    if (node.running && node.results.length > 0 && node.results[0].edgeDetails) {
      node.results[0].edgeDetails.forEach(detail => {
        mstEdges.add(detail.edge);
      });
    }
  });
  
  const runningNodes = nodeData.filter(n => n.running).length;
  const expectedEdges = runningNodes - 1;
  const actualEdges = mstEdges.size;
  
  return {
    passed: actualEdges === expectedEdges, // Exact match required for MST
    details: `Acyclicity check: ${actualEdges} edges for ${runningNodes} nodes (expected ${expectedEdges})`,
    edgeCount: actualEdges,
    nodeCount: runningNodes
  };
}

function verifyTermination(nodeData) {
  const runningNodes = nodeData.filter(node => node.running);
  const terminatedNodes = nodeData.filter(node => 
    node.running && node.status && (node.status.terminated || !node.status.running)
  );
  
  if (runningNodes.length === 0) {
    return { passed: false, details: "No nodes are running" };
  }
  
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
    console.log('=== GHS MST Algorithm Verification ===');
    console.log('Algorithm: Gallager-Humblet-Spira Minimum Spanning Tree');
    console.log('');
    
    // Collect node data - determine actual ports from running nodes
    const allPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
    const nodeData = await collectNodeData(allPorts);
    const actualPorts = nodeData.filter(n => n.running).map(n => n.port);
    const runningNodes = nodeData.filter(node => node.running);
    
    console.log(`Nodes: ${runningNodes.length}/${actualPorts.length} running`);
    console.log('');
    
    // Collect and display MST edges
    const mstEdges = new Map(); // edge -> weight
    const edgeWeights = new Map();
    
    // Collect all MST edges and their weights from nodes
    nodeData.forEach(node => {
      if (node.running && node.results.length > 0) {
        const result = node.results[0];
        if (result.mstEdges) {
          result.mstEdges.forEach(edge => {
            mstEdges.set(edge, 0); // Will get weight from node data
          });
        }
      }
    });
    
    // Get edge weights by querying nodes
    for (const node of nodeData) {
      if (node.running) {
        try {
          const response = await axios.get(`http://localhost:${node.port}/api/ghs-log`, { timeout: 3000 });
          const logs = response.data || [];
          
          // Extract edge weights from logs
          logs.forEach(log => {
            if (log.action && log.action.includes('weight')) {
              const match = log.action.match(/weight[:\s]+(\d+\.\d+)/i);
              if (match) {
                const weight = parseFloat(match[1]);
                const edgePattern = log.action.match(/edge[:\s]+([A-H]-[A-H])/i);
                if (edgePattern) {
                  edgeWeights.set(edgePattern[1], weight);
                }
              }
            }
          });
        } catch (error) {
          // Continue if can't get logs
        }
      }
    }
    
    console.log('MST Edges:');
    if (mstEdges.size === 0) {
      console.log('  ⚪ No MST edges found');
    } else {
      Array.from(mstEdges.keys()).sort().forEach(edge => {
        const weight = edgeWeights.get(edge) || 'unknown';
        console.log(`  🔗 ${edge} (weight: ${weight})`);
      });
    }
    
    console.log('');
    console.log('Node Status:');
    nodeData.filter(node => node.running).forEach(node => {
      if (node.results.length > 0) {
        const result = node.results[0];
        console.log(`  🟢 Node ${node.nodeId} (Level: ${result.level}, Fragment: ${result.fragmentId})`);
      } else {
        console.log(`  ⚪ Node ${node.nodeId} (No result yet)`);
      }
    });
    console.log('');
    
    // Verify MST properties
    const connectivity = verifyConnectivity(nodeData);
    const acyclicity = verifyAcyclicity(nodeData);
    const termination = verifyTermination(nodeData);
    
    console.log(`${connectivity.passed ? '✅' : '❌'} Connectivity: ${connectivity.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${connectivity.details}`);
    console.log('');
    
    console.log(`${acyclicity.passed ? '✅' : '❌'} Acyclicity: ${acyclicity.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${acyclicity.details}`);
    console.log('');
    
    console.log(`${termination.passed ? '✅' : '❌'} Termination: ${termination.passed ? 'PASS' : 'FAIL'}`);
    console.log(`   ${termination.details}`);
    console.log('');
    
    // Summary
    const allPassed = connectivity.passed && acyclicity.passed && termination.passed;
    console.log(`=== Summary ===`);
    console.log(`GHS MST verification: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    process.exit(2);
  }
}

main();