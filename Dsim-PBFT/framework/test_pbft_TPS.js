const axios = require('axios');

const TOTAL_REQUESTS = parseInt(process.argv[2]) || 200;       // How many requests you want to fire
const CONCURRENCY = parseInt(process.argv[3]) || 5;           // How many requests in parallel (for burstiness)
const PBFT_PRIMARY_URL = process.env.PRIMARY_URL || process.argv[4] || "http://10.0.1.11:3001/api/client";

let completed = 0;
let startTime, endTime;

console.log(`Starting TPS Test:`);
console.log(`- Target: ${PBFT_PRIMARY_URL}`);
console.log(`- Total Requests: ${TOTAL_REQUESTS}`);
console.log(`- Concurrency: ${CONCURRENCY}`);

async function sendRequest(requestNum) {
  const payload = { operation: "TX", id: requestNum, value: requestNum * 10 };
  const t0 = Date.now();
  try {
    await axios.post(PBFT_PRIMARY_URL, payload, { timeout: 10000 });
    const t1 = Date.now();
    completed++;
    if (completed % 10 === 0 || completed === TOTAL_REQUESTS) {
      console.log(`Request ${requestNum} completed in ${t1 - t0}ms (Total done: ${completed}/${TOTAL_REQUESTS})`);
    }
  } catch (err) {
    console.warn(`Request ${requestNum} failed: ${err.message}`);
  }
}

async function main() {
  startTime = Date.now();
  let nextRequest = 1;

  function batchSend() {
    if (nextRequest > TOTAL_REQUESTS) return;
    let batch = [];
    for (let i = 0; i < CONCURRENCY && nextRequest <= TOTAL_REQUESTS; i++, nextRequest++) {
      batch.push(sendRequest(nextRequest));
    }
    Promise.all(batch).then(() => batchSend());
  }
  batchSend();

  // Monitor until all requests are done
  const monitorInterval = setInterval(() => {
    if (completed >= TOTAL_REQUESTS) {
      endTime = Date.now();
      const elapsedSec = (endTime - startTime) / 1000;
      const tps = (completed / elapsedSec).toFixed(2);
      console.log(`\n========================================`);
      console.log(`All ${TOTAL_REQUESTS} requests completed in ${elapsedSec.toFixed(2)}s`);
      console.log(`Achieved Throughput: ${tps} TPS`);
      console.log(`========================================`);
      clearInterval(monitorInterval);
      process.exit(0);
    }
  }, 500);
}

main();