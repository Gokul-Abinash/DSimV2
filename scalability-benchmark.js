#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

const ALGORITHMS = ['pbft', 'sbft', 'hotstuff', 'raft', 'paxos'];
const REPLICA_COUNTS = [4, 5, 6, 7, 8];
const LATENCY_PROFILES = ['none', 'lan', 'wan'];
const ITERATIONS = 3;
const TPS_TRANSACTION_COUNT = 20;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runCommand(cmd, timeout = 30000) {
  try {
    return execSync(cmd, { 
      timeout, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    console.log(`Command failed: ${cmd}`);
    return null;
  }
}

function getByzantineCount(replicas, algorithm) {
  if (['pbft', 'sbft', 'hotstuff', 'prime'].includes(algorithm)) {
    return Math.floor((replicas - 1) / 3);
  }
  return 0;
}

function getCrashCount(replicas, algorithm) {
  if (['raft', 'paxos'].includes(algorithm)) {
    return Math.floor((replicas - 1) / 2);
  }
  return 0;
}

async function setupTopology(replicas, algorithm) {
  const byzantineCount = getByzantineCount(replicas, algorithm);
  const crashCount = getCrashCount(replicas, algorithm);
  
  let topologyCmd = `bash dsim-cli.sh topology ${replicas} full`;
  
  if (byzantineCount > 0) {
    topologyCmd += ` --byzantine=silent:${byzantineCount}`;
  } else if (crashCount > 0) {
    topologyCmd += ` --crash=crash:${crashCount}`;
  }
  
  console.log(`Setting up ${replicas} replicas for ${algorithm}...`);
  return runCommand(topologyCmd);
}

async function measureLatencyAndTPS(algorithm, replicas, latencyProfile) {
  const startTime = Date.now();
  
  // Set latency profile
  runCommand(`bash dsim-cli.sh latency ${latencyProfile}`);
  
  // Start algorithm
  const startResult = runCommand(`bash dsim-cli.sh ${algorithm} start`);
  if (!startResult) return null;
  
  await sleep(2000); // Wait for nodes to start
  
  // Run TPS test
  const testStart = Date.now();
  const testResult = runCommand(`bash dsim-cli.sh ${algorithm} test --count ${TPS_TRANSACTION_COUNT}`, 45000);
  const testEnd = Date.now();
  
  if (!testResult) {
    runCommand(`bash dsim-cli.sh ${algorithm} stop`);
    return null;
  }
  
  await sleep(3000); // Wait for consensus
  
  // Verify consensus
  const verifyResult = runCommand(`bash dsim-cli.sh ${algorithm} verify`);
  
  // Stop algorithm
  runCommand(`bash dsim-cli.sh ${algorithm} stop`);
  
  const totalDuration = testEnd - testStart;
  const success = verifyResult && verifyResult.includes('✅');
  
  // Extract TPS from test output
  let tps = 0;
  if (testResult.includes('TPS:')) {
    const tpsMatch = testResult.match(/TPS:\s*([0-9.]+)/);
    if (tpsMatch) tps = parseFloat(tpsMatch[1]);
  } else if (success) {
    // Calculate TPS if not provided
    tps = (TPS_TRANSACTION_COUNT / totalDuration) * 1000;
  }
  
  return {
    algorithm,
    replicas,
    latencyProfile,
    success,
    duration: totalDuration,
    tps: tps,
    transactionCount: TPS_TRANSACTION_COUNT
  };
}

async function runScalabilityBenchmark() {
  const results = [];
  const csvFile = `scalability-benchmark-${timestamp()}.csv`;
  
  console.log('🚀 Starting Scalability Benchmark');
  console.log(`Testing ${ALGORITHMS.length} algorithms × ${REPLICA_COUNTS.length} replica counts × ${LATENCY_PROFILES.length} latency profiles × ${ITERATIONS} iterations`);
  console.log(`Total tests: ${ALGORITHMS.length * REPLICA_COUNTS.length * LATENCY_PROFILES.length * ITERATIONS}`);
  
  let testCount = 0;
  const totalTests = ALGORITHMS.length * REPLICA_COUNTS.length * LATENCY_PROFILES.length * ITERATIONS;
  
  for (const algorithm of ALGORITHMS) {
    console.log(`\n📊 Testing ${algorithm.toUpperCase()}`);
    
    for (const replicas of REPLICA_COUNTS) {
      console.log(`\n  🔧 ${replicas} replicas`);
      
      // Setup topology once per replica count
      await setupTopology(replicas, algorithm);
      
      for (const latencyProfile of LATENCY_PROFILES) {
        console.log(`    🌐 ${latencyProfile} latency`);
        
        for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
          testCount++;
          console.log(`      ⚡ Iteration ${iteration}/${ITERATIONS} (${testCount}/${totalTests})`);
          
          const result = await measureLatencyAndTPS(algorithm, replicas, latencyProfile);
          
          if (result) {
            results.push({
              ...result,
              iteration,
              timestamp: new Date().toISOString()
            });
            console.log(`        ✅ Success: ${result.duration}ms, ${result.tps.toFixed(2)} TPS`);
          } else {
            results.push({
              algorithm,
              replicas,
              latencyProfile,
              iteration,
              success: false,
              duration: 0,
              tps: 0,
              transactionCount: TPS_TRANSACTION_COUNT,
              timestamp: new Date().toISOString()
            });
            console.log(`        ❌ Failed`);
          }
          
          await sleep(1000); // Brief pause between iterations
        }
      }
    }
  }
  
  // Generate CSV report
  generateCSVReport(results, csvFile);
  generateSummaryReport(results);
  
  console.log(`\n📈 Benchmark complete! Results saved to: ${csvFile}`);
}

function generateCSVReport(results, filename) {
  const headers = [
    'Algorithm',
    'Replicas',
    'Latency_Profile',
    'Iteration',
    'Success',
    'Duration_ms',
    'TPS',
    'Transaction_Count',
    'Timestamp'
  ];
  
  const csvContent = [
    headers.join(','),
    ...results.map(r => [
      r.algorithm,
      r.replicas,
      r.latencyProfile,
      r.iteration,
      r.success,
      r.duration,
      r.tps.toFixed(2),
      r.transactionCount,
      r.timestamp
    ].join(','))
  ].join('\n');
  
  fs.writeFileSync(filename, csvContent);
}

function generateSummaryReport(results) {
  console.log('\n📊 SCALABILITY SUMMARY REPORT');
  console.log('=' .repeat(80));
  
  // Group by algorithm and replicas
  const summary = {};
  
  results.forEach(r => {
    const key = `${r.algorithm}-${r.replicas}`;
    if (!summary[key]) {
      summary[key] = {
        algorithm: r.algorithm,
        replicas: r.replicas,
        tests: [],
        successCount: 0,
        totalTests: 0
      };
    }
    
    summary[key].tests.push(r);
    summary[key].totalTests++;
    if (r.success) summary[key].successCount++;
  });
  
  // Print summary table
  console.log('Algorithm'.padEnd(12) + 'Replicas'.padEnd(10) + 'Success%'.padEnd(10) + 'Avg TPS'.padEnd(12) + 'Avg Latency');
  console.log('-'.repeat(80));
  
  Object.values(summary).forEach(s => {
    const successRate = (s.successCount / s.totalTests * 100).toFixed(1);
    const successfulTests = s.tests.filter(t => t.success);
    const avgTPS = successfulTests.length > 0 
      ? (successfulTests.reduce((sum, t) => sum + t.tps, 0) / successfulTests.length).toFixed(2)
      : '0.00';
    const avgLatency = successfulTests.length > 0
      ? (successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length).toFixed(0)
      : '0';
    
    console.log(
      s.algorithm.toUpperCase().padEnd(12) +
      s.replicas.toString().padEnd(10) +
      `${successRate}%`.padEnd(10) +
      `${avgTPS}`.padEnd(12) +
      `${avgLatency}ms`
    );
  });
  
  console.log('\n🎯 Key Insights:');
  
  // Find best performing algorithm by TPS
  const avgTpsByAlgorithm = {};
  ALGORITHMS.forEach(alg => {
    const algResults = results.filter(r => r.algorithm === alg && r.success);
    if (algResults.length > 0) {
      avgTpsByAlgorithm[alg] = algResults.reduce((sum, r) => sum + r.tps, 0) / algResults.length;
    }
  });
  
  const bestTPS = Object.entries(avgTpsByAlgorithm).sort((a, b) => b[1] - a[1])[0];
  if (bestTPS) {
    console.log(`• Highest average TPS: ${bestTPS[0].toUpperCase()} (${bestTPS[1].toFixed(2)} TPS)`);
  }
  
  // Scalability analysis
  ALGORITHMS.forEach(alg => {
    const algResults = results.filter(r => r.algorithm === alg && r.success);
    if (algResults.length > 0) {
      const tpsByReplicas = {};
      REPLICA_COUNTS.forEach(count => {
        const replicaResults = algResults.filter(r => r.replicas === count);
        if (replicaResults.length > 0) {
          tpsByReplicas[count] = replicaResults.reduce((sum, r) => sum + r.tps, 0) / replicaResults.length;
        }
      });
      
      const replicaCounts = Object.keys(tpsByReplicas).map(Number).sort((a, b) => a - b);
      if (replicaCounts.length >= 2) {
        const minTPS = tpsByReplicas[replicaCounts[0]];
        const maxTPS = tpsByReplicas[replicaCounts[replicaCounts.length - 1]];
        const scalabilityFactor = ((maxTPS / minTPS - 1) * 100).toFixed(1);
        console.log(`• ${alg.toUpperCase()} scalability: ${scalabilityFactor}% TPS change from ${replicaCounts[0]} to ${replicaCounts[replicaCounts.length - 1]} replicas`);
      }
    }
  });
}

async function runSingleAlgorithmBenchmark(algorithm) {
  const results = [];
  const csvFile = `scalability-${algorithm}-${timestamp()}.csv`;
  
  console.log(`🚀 Starting Scalability Benchmark for ${algorithm.toUpperCase()}`);
  console.log(`Testing ${REPLICA_COUNTS.length} replica counts × ${LATENCY_PROFILES.length} latency profiles × ${ITERATIONS} iterations`);
  console.log(`Total tests: ${REPLICA_COUNTS.length * LATENCY_PROFILES.length * ITERATIONS}`);
  
  let testCount = 0;
  const totalTests = REPLICA_COUNTS.length * LATENCY_PROFILES.length * ITERATIONS;
  
  console.log(`\n📊 Testing ${algorithm.toUpperCase()}`);
  
  for (const replicas of REPLICA_COUNTS) {
    console.log(`\n  🔧 ${replicas} replicas`);
    
    await setupTopology(replicas, algorithm);
    
    for (const latencyProfile of LATENCY_PROFILES) {
      console.log(`    🌐 ${latencyProfile} latency`);
      
      for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
        testCount++;
        console.log(`      ⚡ Iteration ${iteration}/${ITERATIONS} (${testCount}/${totalTests})`);
        
        const result = await measureLatencyAndTPS(algorithm, replicas, latencyProfile);
        
        if (result) {
          results.push({
            ...result,
            iteration,
            timestamp: new Date().toISOString()
          });
          console.log(`        ✅ Success: ${result.duration}ms, ${result.tps.toFixed(2)} TPS`);
        } else {
          results.push({
            algorithm,
            replicas,
            latencyProfile,
            iteration,
            success: false,
            duration: 0,
            tps: 0,
            transactionCount: TPS_TRANSACTION_COUNT,
            timestamp: new Date().toISOString()
          });
          console.log(`        ❌ Failed`);
        }
        
        await sleep(1000);
      }
    }
  }
  
  generateCSVReport(results, csvFile);
  generateSingleAlgorithmSummary(results, algorithm);
  
  console.log(`\n📈 Benchmark complete! Results saved to: ${csvFile}`);
}

function generateSingleAlgorithmSummary(results, algorithm) {
  console.log(`\n📊 ${algorithm.toUpperCase()} SCALABILITY REPORT`);
  console.log('='.repeat(60));
  
  console.log('Replicas'.padEnd(10) + 'Latency'.padEnd(12) + 'Success%'.padEnd(10) + 'Avg TPS'.padEnd(12) + 'Avg Latency');
  console.log('-'.repeat(60));
  
  const summary = {};
  results.forEach(r => {
    const key = `${r.replicas}-${r.latencyProfile}`;
    if (!summary[key]) {
      summary[key] = { replicas: r.replicas, latencyProfile: r.latencyProfile, tests: [], successCount: 0, totalTests: 0 };
    }
    summary[key].tests.push(r);
    summary[key].totalTests++;
    if (r.success) summary[key].successCount++;
  });
  
  Object.values(summary).forEach(s => {
    const successRate = (s.successCount / s.totalTests * 100).toFixed(1);
    const successfulTests = s.tests.filter(t => t.success);
    const avgTPS = successfulTests.length > 0 
      ? (successfulTests.reduce((sum, t) => sum + t.tps, 0) / successfulTests.length).toFixed(2)
      : '0.00';
    const avgLatency = successfulTests.length > 0
      ? (successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length).toFixed(0)
      : '0';
    
    console.log(
      s.replicas.toString().padEnd(10) +
      s.latencyProfile.padEnd(12) +
      `${successRate}%`.padEnd(10) +
      `${avgTPS}`.padEnd(12) +
      `${avgLatency}ms`
    );
  });
  
  // Scalability analysis
  const tpsByReplicas = {};
  REPLICA_COUNTS.forEach(count => {
    const replicaResults = results.filter(r => r.replicas === count && r.success);
    if (replicaResults.length > 0) {
      tpsByReplicas[count] = replicaResults.reduce((sum, r) => sum + r.tps, 0) / replicaResults.length;
    }
  });
  
  const replicaCounts = Object.keys(tpsByReplicas).map(Number).sort((a, b) => a - b);
  if (replicaCounts.length >= 2) {
    const minTPS = tpsByReplicas[replicaCounts[0]];
    const maxTPS = tpsByReplicas[replicaCounts[replicaCounts.length - 1]];
    const scalabilityFactor = ((maxTPS / minTPS - 1) * 100).toFixed(1);
    console.log(`\n🎯 Scalability: ${scalabilityFactor}% TPS change from ${replicaCounts[0]} to ${replicaCounts[replicaCounts.length - 1]} replicas`);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    runScalabilityBenchmark().catch(console.error);
  } else if (args.length === 1 && ALGORITHMS.includes(args[0])) {
    runSingleAlgorithmBenchmark(args[0]).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node scalability-benchmark.js              # Test all algorithms');
    console.log('  node scalability-benchmark.js <algorithm>  # Test single algorithm');
    console.log(`  Available algorithms: ${ALGORITHMS.join(', ')}`);
  }
}

module.exports = { runScalabilityBenchmark, runSingleAlgorithmBenchmark };