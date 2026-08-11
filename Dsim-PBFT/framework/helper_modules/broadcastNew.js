// const { default: axios } = require('axios');

const axios = require('axios'); // Ensure axios is installed and imported




async function sendPostRequestsToIPs(postData, ipsArray, portArray, endpointArray) {
    const responses = []; // Initialize an empty array to store responses
    try {
        // Create an array of promises for each POST request
        const promises = ipsArray.map(async (ip, index) => {
            const port = portArray[index];
            const endpoint = endpointArray[index];
            const url = `http://${ip}:${port}/${endpoint}`;
            //console.log(url);
            try {
                const response = await axios.post(url, postData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                responses.push({ ip, data: response.data, error: null }); // Store the response
            } catch (error) {
                responses.push({ ip, data: null, error: error.message }); // Store the error
            }
        });

        // Execute all promises simultaneously
        await Promise.all(promises);

        // Log all responses
        responses.forEach(result => {
            if (result.error) {
                console.error(`Error from IP ${result.ip}:`, result.error);
            } else {
                console.log(`Response from IP ${result.ip}:`, result.data);
            }
        });
    } catch (error) {
        console.error('General Error:', error.message);
    }

    return responses; // Return the array of responses
}


function createUniqueListFromResponses(arrayOfObjects) {
    // Step 1: Extract all data arrays from each object
    const dataArray = arrayOfObjects.map(obj => obj.data);
    
    // Step 2: Flatten the array of arrays into a single array
    const flattenedArray = dataArray.flat();
    
    // Step 3: Use a Set to store unique values
    const uniqueSet = new Set(flattenedArray);
    
    // Step 4: Convert the Set back to an array (if needed)
    const uniqueList = [...uniqueSet];
    
    return uniqueList;
}


// async function sendPostRequestsToIPs(postData, ips, endpoint) {
//     try {
//         // Create an array of promises for each POST request
//         const promises = ips.map(ip => {
//             const url = `http://${ip}/${endpoint}`;
//             return axios.post(url, postData, {
//                 headers: {
//                     'Content-Type': 'application/json'
//                 }
//             });
//         });

//         // Execute all promises simultaneously
//         const responses = await Promise.all(promises);

//         // Log responses
//         responses.forEach((response, index) => {
//             console.log(`Response from IP ${ips[index]}:`, response.data);
//         });
//     } catch (error) {
//         console.error('Error:', error.message);
//     }
// }



// // Example usage
// const postData = { key: 'value' };
// const ips = ['127.0.0.1', '127.0.0.1'];
// const port = ['3003', '3003']
// const endpoint = ['', '']; // Replace with your actual endpoint


// // Testing the above implemented functions
// (async() => {
//     const res =  await sendPostRequestsToIPs(postData, ips, port, endpoint);
//     console.log(res);

// })();
    


// exproting modules
module.exports = {
    sendPostRequestsToIPs,
    createUniqueListFromResponses

    };