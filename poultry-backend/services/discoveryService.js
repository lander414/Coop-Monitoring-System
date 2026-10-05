const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 5005;

/**
 * Find the best local IPv4 address, matching the requesting client's subnet if provided.
 */
function getLocalIpAddress(clientIp = null) {
  const interfaces = os.networkInterfaces();
  const allIps = [];

  for (const name of Object.keys(interfaces)) {
    // Ignore virtual adapters commonly created by VirtualBox, VMware, WSL, or Docker
    const isVirtual = /vEthernet|VirtualBox|VMware|Loopback/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        allIps.push({
          name,
          address: iface.address,
          netmask: iface.netmask,
          isVirtual
        });
      }
    }
  }

  // If a client IP was provided, match the subnet (e.g., first 3 octets for /24)
  if (clientIp) {
    const clientSubnet = clientIp.split('.').slice(0, 3).join('.');
    const subnetMatch = allIps.find((ip) => ip.address.startsWith(clientSubnet));
    if (subnetMatch) return subnetMatch.address;
  }

  // Prioritize active Wi-Fi or Wireless interfaces
  const wifiMatch = allIps.find((ip) => /wi-fi|wlan|wireless/i.test(ip.name));
  if (wifiMatch) return wifiMatch.address;

  // Prefer physical Ethernet interfaces over virtual ones
  const physicalMatch = allIps.find(
    (ip) => !ip.isVirtual && !ip.address.startsWith('192.168.56.') && !ip.address.startsWith('192.168.163.') && !ip.address.startsWith('169.254.')
  );
  if (physicalMatch) return physicalMatch.address;

  if (allIps.length > 0) return allIps[0].address;
  return '127.0.0.1';
}

/**
 * Starts the UDP auto-discovery responder for ESP32 devices.
 */
function startDiscoveryService(httpPort = 3000) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (err) => {
    console.warn('[DISCOVERY] UDP socket error:', err.message);
  });

  socket.on('message', (msg, rinfo) => {
    const text = msg.toString().trim();
    if (text.includes('POULTRY_DISCOVER_REQUEST')) {
      const localIp = getLocalIpAddress(rinfo.address);
      const payload = JSON.stringify({
        service: 'poultry-backend',
        ip: localIp,
        port: httpPort,
        url: `http://${localIp}:${httpPort}/api/devices/ESP32_CAM_01/frames`
      });

      socket.send(payload, rinfo.port, rinfo.address, (err) => {
        if (!err) {
          console.log(`[DISCOVERY] Answered ESP32 at ${rinfo.address}:${rinfo.port} -> ${localIp}:${httpPort}`);
        }
      });
    }
  });

  socket.on('listening', () => {
    try {
      socket.setBroadcast(true);
    } catch (e) {}
    console.log(`[DISCOVERY] UDP service listening on port ${DISCOVERY_PORT}`);
  });

  try {
    socket.bind(DISCOVERY_PORT);
  } catch (err) {
    console.warn('[DISCOVERY] Could not bind UDP discovery port:', err.message);
  }

  // Periodic broadcast every 20 seconds so all listening ESP32s detect backend presence
  const interval = setInterval(() => {
    try {
      const localIp = getLocalIpAddress();
      const payload = JSON.stringify({
        service: 'poultry-backend',
        ip: localIp,
        port: httpPort,
        url: `http://${localIp}:${httpPort}/api/devices/ESP32_CAM_01/frames`
      });
      socket.send(payload, DISCOVERY_PORT, '255.255.255.255');
    } catch (e) {}
  }, 20000);

  return {
    socket,
    stop: () => {
      clearInterval(interval);
      try {
        socket.close();
      } catch (e) {}
    }
  };
}

module.exports = { startDiscoveryService, getLocalIpAddress };
