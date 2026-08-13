const axios = require('axios');

async function sendPostRequestsToIPs(postData, ipsArray, portArray, endpointArray) {
  const responses = [];
  try {
    const promises = ipsArray.map(async (ip, index) => {
      const port = portArray[index];
      const endpoint = endpointArray[index];
      const url = `http://${ip}:${port}/${endpoint}`;
      try {
        const response = await axios.post(url, postData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000
        });
        responses.push({ ip, port, data: response.data, error: null });
      } catch (error) {
        responses.push({ ip, port, data: null, error: error.message });
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('General Error:', error.message);
  }

  return responses;
}

function createUniqueListFromResponses(arrayOfObjects) {
  const dataArray = arrayOfObjects.map(obj => obj.data);
  const flattenedArray = dataArray.flat();
  const uniqueSet = new Set(flattenedArray);
  return [...uniqueSet];
}

module.exports = {
  sendPostRequestsToIPs,
  createUniqueListFromResponses
};