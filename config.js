const config = {
    domain: process.env.DOMAIN || 'attacker.example.com',
    https_interface: '0.0.0.0',
    https_port: 8443,
    polling_time: 2000,
    key: './key.pem',
    cert: './cert.pem',
    debug: 0,
    proxy_interface: '0.0.0.0',
    proxy_port: 8081,
    proxy_allowed_ips: ['127.0.0.1'],
};

module.exports = config;