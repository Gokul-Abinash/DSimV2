#!/usr/bin/env node

// Advanced Network Condition Simulator
// Simulates realistic network conditions including partitions, congestion, and failures

const latencyConfig = require('./latency-config.js');
const { execSync } = require('child_process');

class NetworkSimulator {
  constructor() {
    this.activeSimulations = new Map();
    this.originalProfile = 'none';
  }

  // Simulate network congestion (gradually increasing latency)
  simulateCongestion(duration = 10000, peakLatency = 500) {
    console.log(`[NETWORK] Simulating congestion for ${duration}ms, peak: ${peakLatency}ms`);
    
    const steps = 20;
    const stepDuration = duration / steps;
    let currentStep = 0;
    
    const congestionInterval = setInterval(() => {
      currentStep++;
      
      // Bell curve: low -> high -> low
      const progress = currentStep / steps;
      const bellCurve = Math.sin(progress * Math.PI);
      const currentLatency = Math.round(bellCurve * peakLatency);
      
      latencyConfig.setLatencyProfile('custom', {
        min: currentLatency * 0.8,
        max: currentLatency * 1.2,
        distribution: 'normal',
        mean: currentLatency,
        stddev: currentLatency * 0.1
      });
      
      console.log(`[CONGESTION] Step ${currentStep}/${steps}: ${currentLatency}ms latency`);
      
      if (currentStep >= steps) {
        clearInterval(congestionInterval);
        latencyConfig.setLatencyProfile(this.originalProfile);
        console.log('[CONGESTION] Network congestion simulation ended');
      }
    }, stepDuration);
    
    return congestionInterval;
  }

  // Simulate network partition between node groups
  simulatePartition(nodeGroups, duration = 5000) {
    console.log(`[PARTITION] Simulating network partition for ${duration}ms`);
    console.log(`[PARTITION] Groups: ${JSON.stringify(nodeGroups)}`);
    
    // Store original profile
    this.originalProfile = latencyConfig.getLatencyStats().profile;
    
    // Create partition by setting extremely high latency between groups
    const partitionConfig = {
      min: 999999,
      max: 999999,
      distribution: 'fixed'
    };
    
    latencyConfig.setLatencyProfile('custom', partitionConfig);
    
    // Restore network after duration
    setTimeout(() => {
      latencyConfig.setLatencyProfile(this.originalProfile);
      console.log('[PARTITION] Network partition healed');
    }, duration);
  }

  // Simulate intermittent connectivity (packet loss + variable latency)
  simulateIntermittentConnectivity(duration = 15000, lossRate = 0.2) {
    console.log(`[INTERMITTENT] Simulating unstable network for ${duration}ms, loss rate: ${lossRate * 100}%`);
    
    const originalProfile = latencyConfig.getLatencyStats().profile;
    
    // Set highly variable latency profile
    latencyConfig.setLatencyProfile('custom', {
      min: 10,
      max: 1000,
      distribution: 'exponential',
      lambda: 0.005
    });
    
    // Simulate random connectivity issues
    const connectivityInterval = setInterval(() => {\n      if (Math.random() < lossRate) {\n        console.log('[INTERMITTENT] Temporary connectivity loss');\n        latencyConfig.setLatencyProfile('custom', {\n          min: 999999,\n          max: 999999,\n          distribution: 'fixed'\n        });\n        \n        // Restore after short period\n        setTimeout(() => {\n          latencyConfig.setLatencyProfile('custom', {\n            min: 10,\n            max: 1000,\n            distribution: 'exponential',\n            lambda: 0.005\n          });\n        }, 500 + Math.random() * 1500); // 0.5-2 second outages\n      }\n    }, 2000); // Check every 2 seconds\n    \n    setTimeout(() => {\n      clearInterval(connectivityInterval);\n      latencyConfig.setLatencyProfile(originalProfile);\n      console.log('[INTERMITTENT] Intermittent connectivity simulation ended');\n    }, duration);\n  }\n\n  // Simulate geographic distribution (different latencies between regions)\n  simulateGeographicDistribution(regions) {\n    console.log('[GEOGRAPHIC] Simulating geographic distribution');\n    console.log('[GEOGRAPHIC] Regions:', JSON.stringify(regions));\n    \n    // This would require modifying the latency config to support\n    // node-specific latency matrices, which is already partially implemented\n    \n    const regionLatencies = {\n      'us-east': { base: 20, variance: 10 },\n      'us-west': { base: 40, variance: 15 },\n      'europe': { base: 80, variance: 20 },\n      'asia': { base: 150, variance: 30 }\n    };\n    \n    // Set custom latency profile for geographic simulation\n    latencyConfig.setLatencyProfile('custom', {\n      min: 20,\n      max: 200,\n      distribution: 'normal',\n      mean: 80,\n      stddev: 30\n    });\n    \n    console.log('[GEOGRAPHIC] Geographic latency profile activated');\n  }\n\n  // Simulate DDoS attack (extreme latency and packet loss)\n  simulateDDoSAttack(targetNodes, duration = 8000) {\n    console.log(`[DDOS] Simulating DDoS attack on nodes: ${targetNodes.join(', ')} for ${duration}ms`);\n    \n    const originalProfile = latencyConfig.getLatencyStats().profile;\n    \n    // Extreme latency and instability\n    latencyConfig.setLatencyProfile('custom', {\n      min: 2000,\n      max: 10000,\n      distribution: 'exponential',\n      lambda: 0.001\n    });\n    \n    setTimeout(() => {\n      latencyConfig.setLatencyProfile(originalProfile);\n      console.log('[DDOS] DDoS attack simulation ended');\n    }, duration);\n  }\n\n  // Run a comprehensive network stress test\n  async runStressTest(algorithm = 'pbft') {\n    console.log(`\\n=== Network Stress Test for ${algorithm.toUpperCase()} ===`);\n    \n    const scenarios = [\n      { name: 'Baseline', action: () => latencyConfig.setLatencyProfile('lan') },\n      { name: 'High Latency', action: () => latencyConfig.setLatencyProfile('high') },\n      { name: 'Network Congestion', action: () => this.simulateCongestion(8000, 300) },\n      { name: 'Intermittent Connectivity', action: () => this.simulateIntermittentConnectivity(10000, 0.15) },\n      { name: 'Geographic Distribution', action: () => this.simulateGeographicDistribution(['us-east', 'europe']) }\n    ];\n    \n    const results = [];\n    \n    for (const scenario of scenarios) {\n      console.log(`\\n--- Testing: ${scenario.name} ---`);\n      \n      try {\n        // Start nodes\n        execSync(`bash dsim-cli.sh ${algorithm} start`, { stdio: 'inherit' });\n        await this.sleep(2000);\n        \n        // Apply network condition\n        scenario.action();\n        await this.sleep(1000);\n        \n        // Run test\n        const startTime = Date.now();\n        execSync(`bash dsim-cli.sh ${algorithm} test --values 100,200,300`, { stdio: 'inherit' });\n        await this.sleep(5000);\n        \n        // Verify\n        const verifyResult = execSync(`bash dsim-cli.sh ${algorithm} verify`, { encoding: 'utf8' });\n        const endTime = Date.now();\n        \n        const success = verifyResult.includes('SUCCESS') || verifyResult.includes('✅');\n        const duration = endTime - startTime;\n        \n        results.push({\n          scenario: scenario.name,\n          success,\n          duration,\n          algorithm\n        });\n        \n        console.log(`Result: ${success ? 'SUCCESS' : 'FAILED'} in ${duration}ms`);\n        \n      } catch (error) {\n        console.error(`Error in ${scenario.name}:`, error.message);\n        results.push({\n          scenario: scenario.name,\n          success: false,\n          duration: -1,\n          error: error.message,\n          algorithm\n        });\n      } finally {\n        // Stop nodes and reset network\n        try {\n          execSync(`bash dsim-cli.sh ${algorithm} stop`, { stdio: 'pipe' });\n        } catch (e) {}\n        \n        latencyConfig.setLatencyProfile('none');\n        await this.sleep(2000);\n      }\n    }\n    \n    // Print summary\n    console.log('\\n=== Stress Test Results ===');\n    results.forEach(r => {\n      console.log(`${r.scenario}: ${r.success ? 'PASS' : 'FAIL'} (${r.duration}ms)`);\n    });\n    \n    const successRate = (results.filter(r => r.success).length / results.length) * 100;\n    console.log(`\\nOverall Success Rate: ${successRate.toFixed(1)}%`);\n    \n    return results;\n  }\n\n  sleep(ms) {\n    return new Promise(resolve => setTimeout(resolve, ms));\n  }\n\n  // Stop all active simulations\n  stopAllSimulations() {\n    this.activeSimulations.forEach((simulation, id) => {\n      clearInterval(simulation);\n      console.log(`[NETWORK] Stopped simulation: ${id}`);\n    });\n    this.activeSimulations.clear();\n    latencyConfig.setLatencyProfile('none');\n  }\n}\n\n// CLI interface\nif (require.main === module) {\n  const simulator = new NetworkSimulator();\n  const args = process.argv.slice(2);\n  \n  if (args.length === 0) {\n    console.log('Network Simulator Usage:');\n    console.log('  node network-simulator.js congestion [duration] [peak_latency]');\n    console.log('  node network-simulator.js partition [duration]');\n    console.log('  node network-simulator.js intermittent [duration] [loss_rate]');\n    console.log('  node network-simulator.js ddos [duration]');\n    console.log('  node network-simulator.js stress [algorithm]');\n    console.log('');\n    console.log('Examples:');\n    console.log('  node network-simulator.js congestion 15000 400');\n    console.log('  node network-simulator.js partition 8000');\n    console.log('  node network-simulator.js stress pbft');\n    process.exit(1);\n  }\n  \n  const command = args[0];\n  \n  switch (command) {\n    case 'congestion':\n      const duration = parseInt(args[1]) || 10000;\n      const peakLatency = parseInt(args[2]) || 500;\n      simulator.simulateCongestion(duration, peakLatency);\n      break;\n      \n    case 'partition':\n      const partitionDuration = parseInt(args[1]) || 5000;\n      simulator.simulatePartition([['A', 'B'], ['C', 'D']], partitionDuration);\n      break;\n      \n    case 'intermittent':\n      const intermittentDuration = parseInt(args[1]) || 15000;\n      const lossRate = parseFloat(args[2]) || 0.2;\n      simulator.simulateIntermittentConnectivity(intermittentDuration, lossRate);\n      break;\n      \n    case 'ddos':\n      const ddosDuration = parseInt(args[1]) || 8000;\n      simulator.simulateDDoSAttack(['A', 'B'], ddosDuration);\n      break;\n      \n    case 'stress':\n      const algorithm = args[1] || 'pbft';\n      simulator.runStressTest(algorithm).catch(console.error);\n      break;\n      \n    default:\n      console.error('Unknown command:', command);\n      process.exit(1);\n  }\n}\n\nmodule.exports = NetworkSimulator;