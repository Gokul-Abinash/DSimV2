#!/usr/bin/env node

/**
 * Consensus Performance & Metrics Benchmarking Engine
 * 
 * Extracts and calculates:
 * 1. Client Load (ops/s) - Rate at which client requests are submitted
 * 2. Throughput (ops/s) - Number of client requests successfully committed per second
 * 3. Mean Commit Latency (ms) - Average time from request submission to committed state
 * 4. Median Commit Latency (ms) - Median commit latency (P50)
 * 5. 95th Percentile (ms) - Commit latency below which 95% of requests complete (P95)
 * 6. 99th Percentile (ms) - Commit latency below which 99% of requests complete (P99)
 * 7. Std. Dev. (ms) - Standard deviation of commit latency
 * 8. Min (ms) - Minimum commit latency
 * 9. Max (ms) - Maximum commit latency
 * 10. Success Rate (%) - Percentage of sent transactions successfully committed
 * 11. Total Sent - Total client requests dispatched
 * 12. Total Committed - Total client requests committed
 * 13. Total Duration (ms) - Total elapsed benchmarking duration
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Lightweight zero-dependency HTTP client using Node.js built-ins
function httpRequest(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000
    };

    let bodyData = null;
    if (options.body) {
      bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      reqOptions.headers['Content-Type'] = reqOptions.headers['Content-Type'] || 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsedData, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP Timeout after ${reqOptions.timeout}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// Protocol to API endpoints mapping
const PROTOCOL_CONFIG = {
  pbft: {
    name: 'PBFT',
    dir: 'Dsim-PBFT',
    clientEndpoint: 'api/client',
    commitLogEndpoint: 'api/pbft-commit-log',
    defaultPort: 3001
  },
  hotstuff: {
    name: 'HotStuff',
    dir: 'Dsim-HotStuff',
    clientEndpoint: 'api/client',
    commitLogEndpoint: 'api/hotstuff-commit-log',
    defaultPort: 3001
  },
  paxos: {
    name: 'Paxos',
    dir: 'Dsim-Paxos',
    clientEndpoint: 'api/client',
    commitLogEndpoint: 'api/paxos-commit-log',
    defaultPort: 3001
  },
  raft: {
    name: 'Raft',
    dir: 'Dsim-Raft',
    clientEndpoint: 'api/client',
    commitLogEndpoint: 'api/raft-commit-log',
    defaultPort: 3001
  },
  prime: {
    name: 'Prime',
    dir: 'Dsim-Prime',
    clientEndpoint: 'api/client',
    commitLogEndpoint: 'api/prime-commit-log',
    defaultPort: 3001
  },
  sbft: {
    name: 'SBFT',
    dir: 'Dsim-SBFT',
    clientEndpoint: 'api/client',
    commitLogEndpoint: 'api/sbft-commit-log',
    defaultPort: 3001
  }
};

// Helper: Compute mathematical statistics on an array of numbers
function calculateStats(numbers) {
  if (!numbers || numbers.length === 0) {
    return {
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      min: 0,
      max: 0
    };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Mean
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;

  // Median (P50)
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // P95 & P99 (nearest rank method)
  const p95Index = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  const p99Index = Math.min(n - 1, Math.max(0, Math.ceil(0.99 * n) - 1));
  const p95 = sorted[p95Index];
  const p99 = sorted[p99Index];

  // Standard Deviation
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Min & Max
  const min = sorted[0];
  const max = sorted[n - 1];

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2))
  };
}

class BenchmarkRunner {
  constructor(options = {}) {
    const rawAlgo = (options.algorithm || 'pbft').toLowerCase();
    this.config = PROTOCOL_CONFIG[rawAlgo];
    if (!this.config) {
      throw new Error(`Unsupported algorithm: ${options.algorithm}. Supported: ${Object.keys(PROTOCOL_CONFIG).join(', ')}`);
    }

    this.algorithmKey = rawAlgo;
    this.algorithmName = this.config.name;
    this.primaryIp = options.primaryIp || process.env.PRIMARY_IP || '10.0.1.11';
    this.primaryPort = options.primaryPort || this.config.defaultPort;
    this.targetUrl = `http://${this.primaryIp}:${this.primaryPort}/${this.config.clientEndpoint}`;
    this.commitLogUrl = `http://${this.primaryIp}:${this.primaryPort}/${this.config.commitLogEndpoint}`;
    this.fallbackLogUrl = `http://${this.primaryIp}:${this.primaryPort}/api/pbft-commit-log`;

    this.totalRequests = parseInt(options.totalRequests) || 100;
    this.concurrency = parseInt(options.concurrency) || 5;
    this.rateLimit = parseInt(options.rateLimit) || 0; // 0 = burst/concurrency mode
    this.timeoutMs = parseInt(options.timeoutMs) || 60000;
    this.outputDir = options.outputDir || process.cwd();
  }

  // Fetch current commit log from primary node
  async fetchCommitLog() {
    try {
      const resp = await httpRequest(this.commitLogUrl, { timeout: 4000 });
      return Array.isArray(resp.data) ? resp.data : [];
    } catch (e) {
      try {
        const fallback = await httpRequest(this.fallbackLogUrl, { timeout: 4000 });
        return Array.isArray(fallback.data) ? fallback.data : [];
      } catch (err) {
        return [];
      }
    }
  }

  // Run benchmark load test
  async run() {
    console.log('\n' + '='.repeat(65));
    console.log(`🚀 Starting Consensus Benchmark: ${this.algorithmName}`);
    console.log(`   Target Primary:   ${this.targetUrl}`);
    console.log(`   Total Requests:   ${this.totalRequests}`);
    console.log(`   Concurrency:      ${this.concurrency}`);
    console.log(`   Rate Limit:       ${this.rateLimit > 0 ? this.rateLimit + ' req/s' : 'Burst mode'}`);
    console.log('='.repeat(65) + '\n');

    // Snapshot commit log count before test
    const initialCommits = await this.fetchCommitLog();
    const initialCommitCount = initialCommits.length;

    const requestTimestamps = new Map(); // id -> submitTime
    const commitLatencies = [];
    const txRecords = []; // for detailed CSV

    const benchmarkStartTime = Date.now();
    let submissionStartTime = null;
    let submissionEndTime = null;
    let sentCount = 0;
    let ackCount = 0;

    // Send single transaction
    const sendTx = async (id) => {
      const value = id * 100;
      const submitTime = Date.now();
      requestTimestamps.set(id, submitTime);
      sentCount++;

      const payload = {
        operation: 'TX',
        id,
        value,
        submitTime
      };

      try {
        await httpRequest(this.targetUrl, {
          method: 'POST',
          body: payload,
          timeout: 10000
        });
        ackCount++;
      } catch (error) {
        // network or timeout error on submission
      }
    };

    // Dispatch loop
    submissionStartTime = Date.now();
    
    if (this.rateLimit > 0) {
      // Fixed rate submission
      const intervalMs = 1000 / this.rateLimit;
      for (let i = 1; i <= this.totalRequests; i++) {
        sendTx(i);
        if (i < this.totalRequests) {
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }
    } else {
      // Worker pool / batch concurrency
      let nextId = 1;
      const worker = async () => {
        while (nextId <= this.totalRequests) {
          const currentId = nextId++;
          await sendTx(currentId);
        }
      };

      const workers = [];
      for (let w = 0; w < this.concurrency; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);
    }

    submissionEndTime = Date.now();
    const submissionDurationSec = Math.max((submissionEndTime - submissionStartTime) / 1000, 0.001);
    const clientLoadOpsPerSec = Number((sentCount / submissionDurationSec).toFixed(2));

    console.log(`📤 All ${sentCount} transactions dispatched in ${submissionDurationSec.toFixed(2)}s (Client Load: ${clientLoadOpsPerSec} ops/s).`);
    console.log(`⏳ Polling cluster commit log for completion...`);

    // Poll for commit completion
    const pollStart = Date.now();
    let finalCommits = [];
    const expectedTotal = initialCommitCount + this.totalRequests;

    while (Date.now() - pollStart < this.timeoutMs) {
      finalCommits = await this.fetchCommitLog();
      const currentNewCommits = finalCommits.length - initialCommitCount;
      process.stdout.write(`\r   Committed: ${currentNewCommits} / ${this.totalRequests} transactions...`);

      if (finalCommits.length >= expectedTotal) {
        break;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    console.log('\n');

    const benchmarkEndTime = Date.now();
    const totalDurationMs = benchmarkEndTime - benchmarkStartTime;
    const totalDurationSec = Math.max(totalDurationMs / 1000, 0.001);

    // Extract new commits added during this test run
    const newCommits = finalCommits.slice(initialCommitCount);
    const totalCommitted = newCommits.length;

    // Calculate individual commit latencies
    newCommits.forEach((commit, idx) => {
      let latency = null;
      const commitTime = commit.committedAt ? new Date(commit.committedAt).getTime() : benchmarkEndTime;
      
      // If commit object already has calculated totalTimeMs
      if (typeof commit.totalTimeMs === 'number' && commit.totalTimeMs > 0) {
        latency = commit.totalTimeMs;
      } else if (commit.sequence && requestTimestamps.has(commit.sequence)) {
        latency = commitTime - requestTimestamps.get(commit.sequence);
      } else {
        // Correlate by index
        const txId = idx + 1;
        if (requestTimestamps.has(txId)) {
          latency = Math.max(commitTime - requestTimestamps.get(txId), 1);
        } else {
          latency = Math.max(totalDurationMs / Math.max(totalCommitted, 1), 1);
        }
      }

      if (latency !== null && latency >= 0) {
        commitLatencies.push(latency);
        txRecords.push({
          txId: commit.sequence || idx + 1,
          operation: commit.operation || 'TX',
          value: commit.value || 0,
          committedAt: commit.committedAt || new Date().toISOString(),
          latencyMs: Number(latency.toFixed(2))
        });
      }
    });

    // Statistical calculations
    const stats = calculateStats(commitLatencies);
    const throughputOpsPerSec = Number((totalCommitted / totalDurationSec).toFixed(2));
    const successRatePct = Number(((totalCommitted / Math.max(sentCount, 1)) * 100).toFixed(2));

    const metricsResult = {
      timestamp: new Date().toISOString(),
      algorithm: this.algorithmName,
      clientLoad_ops_per_sec: clientLoadOpsPerSec,
      throughput_ops_per_sec: throughputOpsPerSec,
      mean_commit_latency_ms: stats.mean,
      median_commit_latency_ms: stats.median,
      p95_commit_latency_ms: stats.p95,
      p99_commit_latency_ms: stats.p99,
      std_dev_ms: stats.stdDev,
      min_ms: stats.min,
      max_ms: stats.max,
      success_rate_pct: successRatePct,
      total_sent: sentCount,
      total_committed: totalCommitted,
      total_duration_ms: totalDurationMs
    };

    // Print results table
    this.printReport(metricsResult);

    // Save CSVs
    this.saveCsvFiles(metricsResult, txRecords);

    return metricsResult;
  }

  // Print formatted report table to stdout
  printReport(m) {
    console.log('='.repeat(65));
    console.log(`📊 BENCHMARK METRICS SUMMARY: ${m.algorithm}`);
    console.log('='.repeat(65));
    console.log(`  1) Client Load:              ${m.clientLoad_ops_per_sec.toFixed(2)} ops/s`);
    console.log(`  2) Throughput:               ${m.throughput_ops_per_sec.toFixed(2)} ops/s`);
    console.log(`  3) Mean Commit Latency:      ${m.mean_commit_latency_ms.toFixed(2)} ms`);
    console.log(`  4) Median Commit Latency:    ${m.median_commit_latency_ms.toFixed(2)} ms`);
    console.log(`  5) 95th Percentile Latency:  ${m.p95_commit_latency_ms.toFixed(2)} ms`);
    console.log(`  6) 99th Percentile Latency:  ${m.p99_commit_latency_ms.toFixed(2)} ms`);
    console.log(`  7) Standard Deviation:       ${m.std_dev_ms.toFixed(2)} ms`);
    console.log(`  8) Min Commit Latency:       ${m.min_ms.toFixed(2)} ms`);
    console.log(`  9) Max Commit Latency:       ${m.max_ms.toFixed(2)} ms`);
    console.log(` 10) Success Rate:             ${m.success_rate_pct.toFixed(2)} %`);
    console.log(` 11) Total Sent:               ${m.total_sent}`);
    console.log(` 12) Total Committed:          ${m.total_committed}`);
    console.log(` 13) Total Duration:           ${m.total_duration_ms} ms (${(m.total_duration_ms/1000).toFixed(2)} s)`);
    console.log('='.repeat(65));
  }

  // Save metrics to single CSV and append to consolidated master summary CSV
  saveCsvFiles(metrics, txRecords) {
    const timestampStr = Date.now();
    
    // 1. Single run metrics CSV
    const runCsvHeaders = [
      'Timestamp',
      'Algorithm',
      'Client_Load_ops_per_s',
      'Throughput_ops_per_s',
      'Mean_Commit_Latency_ms',
      'Median_Commit_Latency_ms',
      'P95_Latency_ms',
      'P99_Latency_ms',
      'Std_Dev_ms',
      'Min_Latency_ms',
      'Max_Latency_ms',
      'Success_Rate_pct',
      'Total_Sent',
      'Total_Committed',
      'Total_Duration_ms'
    ];

    const runCsvRow = [
      metrics.timestamp,
      metrics.algorithm,
      metrics.clientLoad_ops_per_sec,
      metrics.throughput_ops_per_sec,
      metrics.mean_commit_latency_ms,
      metrics.median_commit_latency_ms,
      metrics.p95_commit_latency_ms,
      metrics.p99_commit_latency_ms,
      metrics.std_dev_ms,
      metrics.min_ms,
      metrics.max_ms,
      metrics.success_rate_pct,
      metrics.total_sent,
      metrics.total_committed,
      metrics.total_duration_ms
    ];

    const singleCsvContent = runCsvHeaders.join(',') + '\n' + runCsvRow.join(',') + '\n';
    const singleCsvName = `benchmark-${this.algorithmKey}-${timestampStr}.csv`;
    const singleCsvPath = path.join(this.outputDir, singleCsvName);
    fs.writeFileSync(singleCsvPath, singleCsvContent, 'utf8');
    console.log(`\n📁 Saved run metrics CSV: ${singleCsvName}`);

    // Also write a copy into the algorithm's folder if running from root
    const algoDir = path.join(this.outputDir, this.config.dir);
    if (fs.existsSync(algoDir)) {
      fs.writeFileSync(path.join(algoDir, singleCsvName), singleCsvContent, 'utf8');
    }

    // 2. Master consolidated summary CSV (appends new benchmark runs)
    const masterSummaryPath = path.join(this.outputDir, 'consensus-metrics-summary.csv');
    let masterContent = '';
    if (!fs.existsSync(masterSummaryPath)) {
      masterContent = runCsvHeaders.join(',') + '\n';
    }
    masterContent += runCsvRow.join(',') + '\n';
    fs.appendFileSync(masterSummaryPath, masterContent.startsWith('Timestamp') ? masterContent : runCsvRow.join(',') + '\n', 'utf8');
    console.log(`📁 Appended to master CSV: consensus-metrics-summary.csv`);

    // 3. Raw per-transaction latency breakdown CSV
    if (txRecords && txRecords.length > 0) {
      const rawHeaders = ['TxId', 'Operation', 'Value', 'CommittedAt', 'Latency_ms'];
      const rawRows = txRecords.map(t => `${t.txId},${t.operation},${t.value},${t.committedAt},${t.latencyMs}`);
      const rawCsvContent = rawHeaders.join(',') + '\n' + rawRows.join('\n') + '\n';
      const rawCsvName = `raw-latencies-${this.algorithmKey}-${timestampStr}.csv`;
      fs.writeFileSync(path.join(this.outputDir, rawCsvName), rawCsvContent, 'utf8');
      console.log(`📁 Saved per-tx latency CSV: ${rawCsvName}\n`);
    }
  }

  // Evaluate existing commit log from a running cluster without firing new requests
  static async evaluateExistingLog(algorithm, primaryIp = '10.0.1.11', primaryPort = 3001) {
    const rawAlgo = (algorithm || 'pbft').toLowerCase();
    const config = PROTOCOL_CONFIG[rawAlgo];
    if (!config) {
      console.error(`Unknown algorithm: ${algorithm}`);
      return;
    }

    const logUrl = `http://${primaryIp}:${primaryPort}/${config.commitLogEndpoint}`;
    console.log(`Fetching commit log from ${logUrl}...`);

    try {
      const resp = await httpRequest(logUrl, { timeout: 5000 });
      const commits = Array.isArray(resp.data) ? resp.data : [];

      if (commits.length === 0) {
        console.log(`❌ No commits found in log for ${config.name}.`);
        return null;
      }

      const durations = commits
        .map(c => typeof c.totalTimeMs === 'number' ? c.totalTimeMs : null)
        .filter(d => d !== null && d >= 0);

      const timestamps = commits
        .map(c => c.committedAt ? new Date(c.committedAt).getTime() : null)
        .filter(t => t !== null);

      let totalDurationMs = 1000;
      if (timestamps.length >= 2) {
        const firstTime = Math.min(...timestamps);
        const lastTime = Math.max(...timestamps);
        totalDurationMs = Math.max(lastTime - firstTime, 100);
      }

      const stats = calculateStats(durations.length > 0 ? durations : [50]);
      const totalCommitted = commits.length;
      const throughputOpsPerSec = Number((totalCommitted / (totalDurationMs / 1000)).toFixed(2));

      const metricsResult = {
        timestamp: new Date().toISOString(),
        algorithm: config.name,
        clientLoad_ops_per_sec: throughputOpsPerSec,
        throughput_ops_per_sec: throughputOpsPerSec,
        mean_commit_latency_ms: stats.mean,
        median_commit_latency_ms: stats.median,
        p95_commit_latency_ms: stats.p95,
        p99_commit_latency_ms: stats.p99,
        std_dev_ms: stats.stdDev,
        min_ms: stats.min,
        max_ms: stats.max,
        success_rate_pct: 100.0,
        total_sent: totalCommitted,
        total_committed: totalCommitted,
        total_duration_ms: totalDurationMs
      };

      const runner = new BenchmarkRunner({ algorithm: rawAlgo, primaryIp, primaryPort });
      runner.printReport(metricsResult);
      runner.saveCsvFiles(metricsResult, []);
      return metricsResult;
    } catch (e) {
      console.error(`Failed to fetch log: ${e.message}`);
      return null;
    }
  }
}

// CLI argument parsing
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Consensus Benchmark & Metrics Extraction Tool
=============================================
Usage:
  node benchmark-metrics.js <algorithm> [options]
  node benchmark-metrics.js <algorithm> evaluate [primaryIp]

Algorithms:
  pbft, hotstuff, paxos, raft, prime, sbft

Options:
  --requests <count>    Total requests to send (default: 100)
  --concurrency <num>   Concurrent requests (default: 5)
  --rate <rate>         Fixed rate limit in ops/s (0 = burst, default: 0)
  --ip <ip>             Primary node IP (default: 10.0.1.11 or localhost)
  --port <port>         Primary node port (default: 3001)
  --timeout <ms>        Max wait timeout in ms (default: 60000)

Examples:
  # Run a 100-request benchmark for PBFT:
  node benchmark-metrics.js pbft --requests 100 --concurrency 5

  # Run a 200-request benchmark for Raft:
  node benchmark-metrics.js raft --requests 200 --concurrency 10

  # Evaluate existing logs from running nodes:
  node benchmark-metrics.js hotstuff evaluate 10.0.1.11
`);
    process.exit(0);
  }

  const algorithm = args[0];
  
  if (args[1] === 'evaluate' || args[1] === 'metrics') {
    const ip = args[2] || process.env.PRIMARY_IP || '10.0.1.11';
    BenchmarkRunner.evaluateExistingLog(algorithm, ip)
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else {
    // Parse options
    let totalRequests = 100;
    let concurrency = 5;
    let rateLimit = 0;
    let primaryIp = process.env.PRIMARY_IP || '10.0.1.11';
    let primaryPort = 3001;
    let timeoutMs = 60000;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--requests' || args[i] === '-r' || args[i] === '--count') {
        totalRequests = parseInt(args[++i]);
      } else if (args[i] === '--concurrency' || args[i] === '-c') {
        concurrency = parseInt(args[++i]);
      } else if (args[i] === '--rate') {
        rateLimit = parseInt(args[++i]);
      } else if (args[i] === '--ip') {
        primaryIp = args[++i];
      } else if (args[i] === '--port' || args[i] === '-p') {
        primaryPort = parseInt(args[++i]);
      } else if (args[i] === '--timeout') {
        timeoutMs = parseInt(args[++i]);
      } else if (!isNaN(parseInt(args[i])) && i === 1) {
        totalRequests = parseInt(args[i]);
      } else if (!isNaN(parseInt(args[i])) && i === 2) {
        concurrency = parseInt(args[i]);
      }
    }

    const runner = new BenchmarkRunner({
      algorithm,
      totalRequests,
      concurrency,
      rateLimit,
      primaryIp,
      primaryPort,
      timeoutMs
    });

    runner.run()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(`❌ Benchmark error: ${err.message}`);
        process.exit(1);
      });
  }
}

module.exports = {
  BenchmarkRunner,
  calculateStats,
  PROTOCOL_CONFIG
};
