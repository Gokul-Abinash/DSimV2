const os = require('os');

function getLocalIP() {
    const ifaces = os.networkInterfaces();
    let ipAddress;

    // Iterate over network interfaces
    Object.keys(ifaces).forEach(ifname => {
        ifaces[ifname].forEach(iface => {
            // Skip over internal and non-IPv4 addresses
            if (iface.internal || iface.family !== 'IPv4') {
                return;
            }

            // Set the IP address
            ipAddress = iface.address;
        });
    });

    return ipAddress;
}

//const myIP = getLocalIP();
//console.log('My IP address:', myIP);


module.exports = 
{
    getLocalIP
};