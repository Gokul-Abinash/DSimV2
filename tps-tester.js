#!/usr/bin/env node

// TPS (Transactions Per Second) Testing Module for DistSim Framework
// Supports burst testing, duration testing, and detailed TPS metrics

const { execSync } = require('child_process');
const fs = require('fs');

class TPSTester {
  constructor(algorithm, nodeCount = 4) {
    this.algorithm = algorithm;
    this.nodeCount = nodeCount;
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  // Burst testing - send all transactions as fast as possible
  async burstTest(count = 100) {
    console.log(`\n=== TPS Burst Test: ${this.algorithm.toUpperCase()} ===`);
    console.log(`Sending ${count} transactions instantly...`);
    
    this.startTime = Date.now();
    const transactions = this.generateTransactions(count);
    
    // Send transactions with minimal stagger for true burst testing
    const promises = transactions.map((tx, index) => 
      this.sendTransactionWithDelay(tx, index, index * 50) // 50ms stagger for burst testing
    );
    
    try {
      const results = await Promise.allSettled(promises);
      this.endTime = Date.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      const duration = (this.endTime - this.startTime) / 1000; // seconds
      
      // Calculate actual TPS based on consensus completion time
      let actualTPS = successful / duration;
      
      // Try to get more accurate TPS from commit timestamps
      try {
        const commitLog = execSync(
          `curl -s --max-time 2 http://localhost:3001/api/${this.algorithm}-commit-log`,
          { encoding: 'utf8' }
        );
        const commits = JSON.parse(commitLog);
        
        if (commits.length >= 2) {
          const timestamps = commits.map(c => new Date(c.committedAt).getTime());
          const firstCommit = Math.min(...timestamps);
          const lastCommit = Math.max(...timestamps);
          const consensusDuration = (lastCommit - firstCommit) / 1000;
          
          if (consensusDuration > 0) {
            actualTPS = commits.length / consensusDuration;
          }
        }
      } catch (e) {
        // Use original calculation if commit log unavailable
      }
      
      const peakTPS = actualTPS;
      
      console.log(`\n📊 Burst Test Results:`);
      console.log(`  Total Transactions: ${count}`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Duration: ${duration.toFixed(2)}s`);
      console.log(`  Peak TPS: ${peakTPS.toFixed(1)} tx/sec`);
      console.log(`  Success Rate: ${((successful/count)*100).toFixed(1)}%`);
      
      // Update test metadata for verification
      this.updateTestMetadata(transactions.slice(0, successful));
      
      return {
        type: 'burst',
        totalTx: count,
        successful,
        failed,
        duration,
        peakTPS,
        successRate: (successful/count)*100
      };
      
    } catch (error) {
      console.error('Burst test failed:', error.message);
      return null;
    }
  }

  // Duration testing - send transactions over a specified time period
  async durationTest(count = 100, durationSeconds = 30) {
    console.log(`\n=== TPS Duration Test: ${this.algorithm.toUpperCase()} ===`);
    console.log(`Sending ${count} transactions over ${durationSeconds} seconds...`);
    
    const interval = (durationSeconds * 1000) / count; // ms between transactions
    const transactions = this.generateTransactions(count);
    
    this.startTime = Date.now();
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < transactions.length; i++) {
      try {
        await this.sendTransaction(transactions[i], i);
        successful++;
        console.log(`Progress: ${i+1}/${count} (${((i+1)/count*100).toFixed(1)}%)`);
      } catch (error) {
        failed++;
        console.error(`Transaction ${i+1} failed:`, error.message);
      }
      
      // Wait for next transaction (except for the last one)
      if (i < transactions.length - 1) {
        await this.sleep(interval);
      }
    }
    
    this.endTime = Date.now();
    const actualDuration = (this.endTime - this.startTime) / 1000;
    const sustainedTPS = successful / actualDuration;
    
    console.log(`\n📊 Duration Test Results:`);
    console.log(`  Total Transactions: ${count}`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Planned Duration: ${durationSeconds}s`);
    console.log(`  Actual Duration: ${actualDuration.toFixed(2)}s`);
    console.log(`  Sustained TPS: ${sustainedTPS.toFixed(1)} tx/sec`);
    console.log(`  Success Rate: ${((successful/count)*100).toFixed(1)}%`);
    
    return {
      type: 'duration',
      totalTx: count,
      successful,
      failed,
      plannedDuration: durationSeconds,
      actualDuration,
      sustainedTPS,
      successRate: (successful/count)*100
    };
  }

  // Generate test transactions
  generateTransactions(count) {
    const transactions = [];
    for (let i = 1; i <= count; i++) {
      transactions.push({
        operation: 'TX',
        id: i,
        value: i * 10, // Use predictable values for verification
        timestamp: Date.now()
      });
    }
    return transactions;
  }

  // Send a single transaction
  async sendTransaction(transaction, index) {
    return new Promise((resolve, reject) => {
      try {
        const response = execSync(
          `curl -s --max-time 5 -X POST http://localhost:3001/api/client ` +
          `-H "Content-Type: application/json" ` +
          `-d '${JSON.stringify(transaction)}'`,
          { encoding: 'utf8', timeout: 10000 }
        );
        
        if (response.includes('ok') || response.includes('true')) {
          resolve({ index, success: true, response });
        } else {
          reject(new Error(`Invalid response: ${response}`));
        }
      } catch (error) {
        reject(new Error(`Network error: ${error.message}`));
      }
    });
  }

  // Send transaction with delay for proper ordering
  async sendTransactionWithDelay(transaction, index, delayMs) {
    await this.sleep(delayMs);
    return this.sendTransaction(transaction, index);
  }

  // Get detailed TPS metrics from the algorithm
  async getTPSMetrics() {
    console.log(`\n=== TPS Metrics: ${this.algorithm.toUpperCase()} ===`);
    
    try {
      // Get commit log from primary node
      const commitLog = execSync(
        `curl -s --max-time 5 http://localhost:3001/api/${this.algorithm}-commit-log`,
        { encoding: 'utf8' }
      );
      
      const commits = JSON.parse(commitLog);
      
      if (commits.length === 0) {
        console.log('No committed transactions found.');
        return null;
      }
      
      // Calculate metrics
      const timestamps = commits.map(c => new Date(c.committedAt).getTime());
      const durations = commits.map(c => c.totalTimeMs).filter(d => d !== null);
      
      const firstCommit = Math.min(...timestamps);
      const lastCommit = Math.max(...timestamps);
      const totalDuration = (lastCommit - firstCommit) / 1000; // seconds
      
      const avgTPS = commits.length / totalDuration;
      const avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minLatency = Math.min(...durations);
      const maxLatency = Math.max(...durations);
      
      console.log(`📈 TPS Metrics:`);
      console.log(`  Total Committed: ${commits.length} transactions`);
      console.log(`  Time Span: ${totalDuration.toFixed(2)}s`);
      console.log(`  Average TPS: ${avgTPS.toFixed(2)} tx/sec`);
      console.log(`  Average Latency: ${avgLatency.toFixed(0)}ms`);
      console.log(`  Latency Range: ${minLatency}-${maxLatency}ms`);
      
      // Calculate TPS over time windows
      const windowSize = 5000; // 5 second windows
      const windows = this.calculateTPSWindows(timestamps, windowSize);
      
      if (windows.length > 1) {
        const tpsValues = windows.map(w => w.tps);
        const peakTPS = Math.max(...tpsValues);
        const minTPS = Math.min(...tpsValues);
        
        console.log(`  Peak TPS (5s window): ${peakTPS.toFixed(1)} tx/sec`);
        console.log(`  Min TPS (5s window): ${minTPS.toFixed(1)} tx/sec`);
      }
      
      return {
        totalCommitted: commits.length,
        totalDuration,
        avgTPS,
        avgLatency,
        minLatency,
        maxLatency,
        peakTPS: windows.length > 1 ? Math.max(...windows.map(w => w.tps)) : avgTPS
      };
      
    } catch (error) {
      console.error('Failed to get TPS metrics:', error.message);
      return null;
    }
  }

  // Calculate TPS in time windows
  calculateTPSWindows(timestamps, windowSize) {
    if (timestamps.length < 2) return [];
    
    const windows = [];
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    for (let start = minTime; start < maxTime; start += windowSize) {
      const end = start + windowSize;
      const count = timestamps.filter(t => t >= start && t < end).length;
      const tps = count / (windowSize / 1000);
      
      if (count > 0) {
        windows.push({ start, end, count, tps });
      }
    }
    
    return windows;
  }

  // Export results to CSV
  exportToCSV(results, filename) {
    const csvData = [
      'Test_Type,Algorithm,Total_Tx,Successful,Failed,Duration_s,TPS,Success_Rate_%',
      `${results.type},${this.algorithm},${results.totalTx},${results.successful},${results.failed},${results.duration || results.actualDuration},${results.peakTPS || results.sustainedTPS},${results.successRate}`
    ].join('\n');
    
    fs.writeFileSync(filename, csvData);
    console.log(`\n📄 Results exported to: ${filename}`);
  }

  // Update test metadata for verification
  updateTestMetadata(transactions) {
    const values = transactions.map(tx => tx.value);
    const metadata = {
      submittedValues: values,
      timestamp: Math.floor(Date.now() / 1000),
      count: values.length,
      algorithm: this.algorithm.toUpperCase(),
      testType: 'TPS_BURST'
    };
    
    try {
      // Update metadata for current algorithm
      const algoMap = {
        'pbft': 'PBFT',
        'sbft': 'SBFT', 
        'raft': 'Raft',
        'paxos': 'Paxos',
        'hotstuff': 'HotStuff'
      };
      const algoDir = algoMap[this.algorithm.toLowerCase()] || this.algorithm;
      const metadataPath = `../Dsim-${algoDir}/framework/test-metadata.json`;
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`Updated test metadata for verification`);
    } catch (error) {
      console.warn('Failed to update test metadata:', error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('TPS Tester Usage:');
    console.log('  node tps-tester.js <algorithm> burst <count>');
    console.log('  node tps-tester.js <algorithm> duration <count> <seconds>');
    console.log('  node tps-tester.js <algorithm> metrics');
    console.log('');
    console.log('Examples:');
    console.log('  node tps-tester.js pbft burst 100');
    console.log('  node tps-tester.js raft duration 50 30');
    console.log('  node tps-tester.js hotstuff metrics');
    process.exit(1);
  }
  
  const algorithm = args[0];
  const testType = args[1];
  
  const tester = new TPSTester(algorithm);
  
  (async () => {
    try {
      let results = null;
      
      switch (testType) {
        case 'burst':
          const count = parseInt(args[2]) || 100;
          results = await tester.burstTest(count);
          if (results) {
            const filename = `tps-burst-${algorithm}-${Date.now()}.csv`;
            tester.exportToCSV(results, filename);
          }
          break;
          
        case 'duration':
          const durationCount = parseInt(args[2]) || 100;
          const seconds = parseInt(args[3]) || 30;
          results = await tester.durationTest(durationCount, seconds);
          if (results) {
            const filename = `tps-duration-${algorithm}-${Date.now()}.csv`;
            tester.exportToCSV(results, filename);
          }
          break;
          
        case 'metrics':
          await tester.getTPSMetrics();
          break;
          
        default:
          console.error('Unknown test type:', testType);
          process.exit(1);
      }
      
    } catch (error) {
      console.error('TPS test failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = TPSTester;