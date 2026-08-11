const axios = require('axios');

const TOTAL_REQUESTS = parseInt(process.argv[2]) || 200;       // How many requests you want to fire
const CONCURRENCY = parseInt(process.argv[3]) || 5;           // How many requests in parallel (for burstiness)
const PBFT_PRIMARY_URL = "http://127.0.0.1:3001/api/client";

let completed = 0;
let startTime, endTime;

async function sendRequest(requestNum) {
  const payload = { operation: "transfer", value: requestNum };
  const t0 = Date.now();
  try {
    await axios.post(PBFT_PRIMARY_URL, payload);
    const t1 = Date.now();
    completed++;
    console.log(`Request ${requestNum} completed in ${t1-t0}ms (Total done: ${completed})`);
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
      console.log(`\nAll ${TOTAL_REQUESTS} requests completed in ${(endTime - startTime)/1000}s`);
      clearInterval(monitorInterval);
      process.exit(0);
    }
  }, 500);
}

main();