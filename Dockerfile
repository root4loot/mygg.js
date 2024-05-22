FROM node:14

RUN apt-get update && apt-get install -y openssl certbot

WORKDIR /app

COPY mygg.js /app/mygg.js

RUN npm install busboy

EXPOSE 8443 8081

ENV DOMAIN=attacker.example.com

CMD certbot certonly --standalone --non-interactive --agree-tos --register-unsafely-without-email -d ${DOMAIN} && \
    cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /app/key.pem && \
    cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /app/cert.pem && \
    node /app/mygg.js