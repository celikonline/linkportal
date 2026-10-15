FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0

WORKDIR /app

COPY --chown=node:node package.json server.mjs index.html app.js vault.mjs share.mjs style.css support.css ./

USER node
EXPOSE 5186

CMD ["node", "server.mjs"]
