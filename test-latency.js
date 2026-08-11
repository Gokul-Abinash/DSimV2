#!/usr/bin/env node

// Latency Testing Script for DistSim Framework
// Tests different latency profiles and measures their impact on consensus performance

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ALGORITHMS = ['pbft', 'sbft', 'raft', 'paxos', 'hotstuff'];
const LATENCY_PROFILES = ['none', 'lan', 'wan', 'high', 'unstable'];
const TEST_VALUES = ['100', '200', '300'];
const TPS_TRANSACTION_COUNT = 20;

async function runLatencyTest(algorithm, profile, iterations = 3) {
  console.log(`\n=== Testing ${algorithm.toUpperCase()} with ${profile} latency ===`);
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1}/${iterations}`);
    
    try {
      // Set latency profile
      execSync(`bash dsim-cli.sh latency ${profile}`, { stdio: 'inherit' });
      
      // Start nodes
      execSync(`bash dsim-cli.sh ${algorithm} start`, { stdio: 'inherit' });
      
      // Wait for nodes to initialize
      await sleep(2000);
      
      // Run latency test
      const latencyStartTime = Date.now();
      execSync(`bash dsim-cli.sh ${algorithm} test --values ${TEST_VALUES.join(',')}`, { stdio: 'inherit' });
      await sleep(3000);
      const latencyEndTime = Date.now();
      
      // Run TPS test
      const tpsStartTime = Date.now();
      const tpsResult = execSync(`bash dsim-cli.sh ${algorithm} test --count ${TPS_TRANSACTION_COUNT}`, { encoding: 'utf8' });
      const tpsEndTime = Date.now();
      await sleep(3000);
      
      // Verify consensus
      const verifyResult = execSync(`bash dsim-cli.sh ${algorithm} verify`, { encoding: 'utf8' });
      
      const latencyDuration = latencyEndTime - latencyStartTime;
      const tpsDuration = tpsEndTime - tpsStartTime;
      const success = verifyResult.includes('SUCCESS') || verifyResult.includes('✅');
      
      // Calculate TPS
      let tps = 0;
      if (success && tpsDuration > 0) {
        tps = (TPS_TRANSACTION_COUNT / tpsDuration) * 1000;
      }
      
      results.push({
        iteration: i + 1,
        latencyDuration,
        tpsDuration,
        tps,
        success,
        profile,
        algorithm
      });
      
      console.log(`Result: ${success ? 'SUCCESS' : 'FAILED'} - Latency: ${latencyDuration}ms, TPS: ${tps.toFixed(2)}`);
      
    } catch (error) {
      console.error(`Error in iteration ${i + 1}:`, error.message);
      results.push({
        iteration: i + 1,
        latencyDuration: -1,
        tpsDuration: -1,
        tps: 0,
        success: false,
        error: error.message,
        profile,
        algorithm
      });
    } finally {
      // Stop nodes
      try {
        execSync(`bash dsim-cli.sh ${algorithm} stop`, { stdio: 'pipe' });
      } catch (e) {
        // Ignore stop errors
      }
      
      await sleep(1000);
    }
  }
  
  return results;
}

function analyzeResults(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length === 0) {
    return {
      successRate: 0,
      avgLatency: -1,
      minLatency: -1,
      maxLatency: -1,
      avgTPS: 0,
      minTPS: 0,
      maxTPS: 0,
      totalTests: results.length
    };
  }
  
  const latencies = successful.map(r => r.latencyDuration);
  const tpsValues = successful.map(r => r.tps);
  
  return {
    successRate: (successful.length / results.length) * 100,
    avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    avgTPS: tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length,
    minTPS: Math.min(...tpsValues),
    maxTPS: Math.max(...tpsValues),
    totalTests: results.length,
    failedTests: failed.length
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSingleAlgorithmBenchmark(algorithm) {
  console.log(`Starting latency benchmark for ${algorithm.toUpperCase()}...`);
  
  const allResults = [];
  
  // Setup topology
  console.log('Setting up 4-node full topology...');
  execSync('bash dsim-cli.sh topology 4 full', { stdio: 'inherit' });
  
  for (const profile of LATENCY_PROFILES) {
    const results = await runLatencyTest(algorithm, profile, 3);
    const analysis = analyzeResults(results);
    
    allResults.push({
      algorithm,
      profile,
      ...analysis,
      rawResults: results
    });
    
    console.log(`\n${algorithm.toUpperCase()} with ${profile} latency:`);
    console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`  Avg Latency: ${analysis.avgLatency.toFixed(0)}ms (${analysis.minLatency}-${analysis.maxLatency}ms)`);
    console.log(`  Avg TPS: ${analysis.avgTPS.toFixed(2)} (${analysis.minTPS.toFixed(2)}-${analysis.maxTPS.toFixed(2)})`);
  }
  
  // Save results to CSV
  const csvContent = generateCSV(allResults);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `latency-${algorithm}-${timestamp}.csv`;
  
  fs.writeFileSync(filename, csvContent);
  console.log(`\nResults saved to: ${filename}`);
  
  // Print algorithm summary
  printAlgorithmSummary(allResults, algorithm);
}

async function runFullLatencyBenchmark() {
  console.log('Starting comprehensive latency benchmark...');
  
  const allResults = [];
  
  // Setup topology
  console.log('Setting up 4-node full topology...');
  execSync('bash dsim-cli.sh topology 4 full', { stdio: 'inherit' });
  
  for (const algorithm of ALGORITHMS) {
    for (const profile of LATENCY_PROFILES) {
      const results = await runLatencyTest(algorithm, profile, 3);
      const analysis = analyzeResults(results);
      
      allResults.push({
        algorithm,
        profile,
        ...analysis,
        rawResults: results
      });
      
      console.log(`\n${algorithm.toUpperCase()} with ${profile} latency:`);
      console.log(`  Success Rate: ${analysis.successRate.toFixed(1)}%`);
      console.log(`  Avg Latency: ${analysis.avgLatency.toFixed(0)}ms (${analysis.minLatency}-${analysis.maxLatency}ms)`);
      console.log(`  Avg TPS: ${analysis.avgTPS.toFixed(2)} (${analysis.minTPS.toFixed(2)}-${analysis.maxTPS.toFixed(2)})`);
    }
  }
  
  // Save results to CSV
  const csvContent = generateCSV(allResults);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `latency-benchmark-${timestamp}.csv`;
  
  fs.writeFileSync(filename, csvContent);
  console.log(`\nResults saved to: ${filename}`);
  
  // Print summary
  printSummary(allResults);
}

function generateCSV(results) {
  const headers = [
    'Algorithm', 'Latency_Profile', 'Success_Rate_%', 'Avg_Latency_ms',
    'Min_Latency_ms', 'Max_Latency_ms', 'Avg_TPS', 'Min_TPS', 'Max_TPS',
    'Total_Tests', 'Failed_Tests'
  ];
  
  const rows = results.map(r => [
    r.algorithm,
    r.profile,
    r.successRate.toFixed(1),
    r.avgLatency.toFixed(0),
    r.minLatency,
    r.maxLatency,
    r.avgTPS.toFixed(2),
    r.minTPS.toFixed(2),
    r.maxTPS.toFixed(2),
    r.totalTests,
    r.failedTests
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function printAlgorithmSummary(results, algorithm) {
  console.log(`\n=== ${algorithm.toUpperCase()} LATENCY SUMMARY ===`);
  
  const successful = results.filter(r => r.successRate > 0);
  
  console.log('\nPerformance by Network Condition:');
  results.forEach(r => {
    if (r.successRate > 0) {
      console.log(`  ${r.profile}: ${r.avgTPS.toFixed(2)} TPS, ${r.avgLatency.toFixed(0)}ms latency, ${r.successRate.toFixed(1)}% success`);
    } else {
      console.log(`  ${r.profile}: FAILED (${r.successRate.toFixed(1)}% success)`);
    }
  });
  
  if (successful.length > 0) {
    const bestTPS = successful.reduce((best, current) => current.avgTPS > best.avgTPS ? current : best);
    const bestLatency = successful.reduce((best, current) => current.avgLatency < best.avgLatency ? current : best);
    
    console.log(`\n🎯 Best TPS: ${bestTPS.avgTPS.toFixed(2)} (${bestTPS.profile} network)`);
    console.log(`🎯 Best Latency: ${bestLatency.avgLatency.toFixed(0)}ms (${bestLatency.profile} network)`);
  }
}

function printSummary(results) {
  console.log('\n=== LATENCY BENCHMARK SUMMARY ===');
  
  // Best performing combinations
  const successful = results.filter(r => r.successRate > 0);
  successful.sort((a, b) => b.successRate - a.successRate || a.avgDuration - b.avgDuration);
  
  console.log('\nTop 5 Best Performing Combinations (by TPS):');
  successful.sort((a, b) => b.avgTPS - a.avgTPS).slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.algorithm.toUpperCase()} + ${r.profile}: ${r.avgTPS.toFixed(2)} TPS, ${r.avgLatency.toFixed(0)}ms latency`);
  });
  
  // Network impact analysis
  console.log('\nNetwork Impact Analysis:');
  LATENCY_PROFILES.forEach(profile => {
    const profileResults = results.filter(r => r.profile === profile && r.successRate > 0);
    if (profileResults.length > 0) {
      const avgSuccess = profileResults.reduce((sum, r) => sum + r.successRate, 0) / profileResults.length;
      const avgLatency = profileResults.reduce((sum, r) => sum + r.avgLatency, 0) / profileResults.length;
      const avgTPS = profileResults.reduce((sum, r) => sum + r.avgTPS, 0) / profileResults.length;
      console.log(`  ${profile}: ${avgSuccess.toFixed(1)}% success, ${avgLatency.toFixed(0)}ms latency, ${avgTPS.toFixed(2)} TPS`);
    }
  });
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node test-latency.js full                    # Run full benchmark');
    console.log('  node test-latency.js <algorithm>             # Test single algorithm');
    console.log('  node test-latency.js <algorithm> <profile>   # Test specific combination');
    console.log('');
    console.log('Algorithms:', ALGORITHMS.join(', '));
    console.log('Profiles:', LATENCY_PROFILES.join(', '));
    process.exit(1);
  }
  
  if (args[0] === 'full') {
    runFullLatencyBenchmark().catch(console.error);
  } else if (args.length === 1 && ALGORITHMS.includes(args[0])) {
    runSingleAlgorithmBenchmark(args[0]).catch(console.error);
  } else if (args.length === 2) {
    const [algorithm, profile] = args;
    if (!ALGORITHMS.includes(algorithm)) {
      console.error('Invalid algorithm:', algorithm);
      process.exit(1);
    }
    if (!LATENCY_PROFILES.includes(profile)) {
      console.error('Invalid profile:', profile);
      process.exit(1);
    }
    
    runLatencyTest(algorithm, profile, 5)
      .then(results => {
        const analysis = analyzeResults(results);
        
        // Generate CSV for single test
        const singleResult = [{
          algorithm,
          profile,
          ...analysis,
          rawResults: results
        }];
        
        const csvContent = generateCSV(singleResult);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `latency-${algorithm}-${profile}-${timestamp}.csv`;
        
        fs.writeFileSync(filename, csvContent);
        
        console.log('\nTest Results:');
        console.log(`Success Rate: ${analysis.successRate.toFixed(1)}%`);
        console.log(`Average Latency: ${analysis.avgLatency.toFixed(0)}ms (${analysis.minLatency}-${analysis.maxLatency}ms)`);
        console.log(`Average TPS: ${analysis.avgTPS.toFixed(2)} (${analysis.minTPS.toFixed(2)}-${analysis.maxTPS.toFixed(2)})`);
        console.log(`\nResults saved to: ${filename}`);
      })
      .catch(console.error);
  } else {
    console.error('Invalid arguments. Use --help for usage.');
    process.exit(1);
  }
}