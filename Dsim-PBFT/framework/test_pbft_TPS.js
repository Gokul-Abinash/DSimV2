const axios = require('axios');
const http = require('http');

// Persistent HTTP Agent to reuse connections and avoid socket exhaustion
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  timeout: 20000
});

const apiClient = axios.create({
  httpAgent,
  timeout: 15000
});

const TOTAL_REQUESTS = parseInt(process.argv[2]) || 200;       // How many requests you want to fire
const CONCURRENCY = parseInt(process.argv[3]) || 5;           // How many requests in parallel (for burstiness)
const PBFT_PRIMARY_URL = process.env.PRIMARY_URL || process.argv[4] || "http://10.0.1.11:3001/api/client";

let completed = 0;
let failed = 0;
let startTime, endTime;

console.log(`Starting TPS Test:`);
console.log(`- Target: ${PBFT_PRIMARY_URL}`);
console.log(`- Total Requests: ${TOTAL_REQUESTS}`);
console.log(`- Concurrency: ${CONCURRENCY}`);

async function sendRequest(requestNum, retries = 2) {
  const payload = { operation: "TX", id: requestNum, value: requestNum * 10 };
  const t0 = Date.now();
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await apiClient.post(PBFT_PRIMARY_URL, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      const t1 = Date.now();
      completed++;
      if (completed % 10 === 0 || completed === TOTAL_REQUESTS) {
        console.log(`Request ${requestNum} completed in ${t1 - t0}ms (Total done: ${completed}/${TOTAL_REQUESTS})`);
      }
      return;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
      } else {
        failed++;
        console.warn(`Request ${requestNum} failed: ${err.message}`);
      }
    }
  }
}

async function main() {
  startTime = Date.now();
  let nextRequest = 1;

  async function batchSend() {
    if (nextRequest > TOTAL_REQUESTS) return;
    let batch = [];
    for (let i = 0; i < CONCURRENCY && nextRequest <= TOTAL_REQUESTS; i++, nextRequest++) {
      batch.push(sendRequest(nextRequest));
    }
    await Promise.all(batch);
    if (nextRequest <= TOTAL_REQUESTS) {
      await new Promise(r => setTimeout(r, 25)); // brief pacing between concurrent batches
      batchSend();
    }
  }
  
  batchSend();

  // Monitor until all requests are done
  const monitorInterval = setInterval(() => {
    if (completed + failed >= TOTAL_REQUESTS) {
      endTime = Date.now();
      const elapsedSec = ((endTime - startTime) / 1000).toFixed(2);
      const tps = (completed / Math.max(0.001, elapsedSec)).toFixed(2);
      const successRate = ((completed / TOTAL_REQUESTS) * 100).toFixed(1);
      console.log(`\n========================================`);
      console.log(`Summary: ${completed}/${TOTAL_REQUESTS} requests succeeded (${successRate}%) in ${elapsedSec}s`);
      console.log(`Achieved Throughput: ${tps} TPS`);
      console.log(`========================================`);
      clearInterval(monitorInterval);
      process.exit(0);
    }
  }, 500);
}

main();