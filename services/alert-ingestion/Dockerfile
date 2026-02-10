FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN rm -rf node_modules && npm install
RUN ls -l node_modules
RUN ls -l node_modules/uuid

COPY src/ ./src/

EXPOSE 8001

CMD ["node", "src/server.js"]
