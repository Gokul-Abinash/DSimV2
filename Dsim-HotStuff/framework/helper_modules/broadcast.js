const { default: axios } = require('axios');
const local_IP = require('./local_IP');
const { graph, getNeighborIP, isIPBelongToNode } = require('./graph.js');




// see if this is needed or not needed if this is not needed delete

function braodcastFun(data){
    const myIP = local_IP.getLocalIP();
    const myName = isIPBelongToNode('127.0.0.1');
    const myNbrs = getNeighborIP(myName);

    //data1 = {data};

    // console.log('my data', data1);
    // console.log('my nbrs', myNbrs);

    sendPostRequestsToIPs(data, myNbrs);
};




async function sendPostRequestsToIPs(postData, ips, endpoint) {
    try {
        // Create an array of promises for each POST request
        const promises = ips.map(ip => {
            const url = `http://${ip}/${endpoint}`; // Replace 'your-endpoint' with your actual endpoint
            return axios.post(url, postData);
        });

        // Execute all promises simultaneously
        const responses = await Promise.all(promises);

        // Log responses
        responses.forEach((response, index) => {
            console.log(`Response from IP ${ips[index]}:`, response.data);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}


// const postData = {username: '192920'};
// const myNbrs = ['127.0.0.1:3003'];

// braodcastFun(postData, '127.0.0.1');


// exproting modules
module.exports = {
                sendPostRequestsToIPs,
                braodcastFun};