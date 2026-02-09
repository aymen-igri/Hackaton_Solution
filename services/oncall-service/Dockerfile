FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm i


COPY src/ ./src/

EXPOSE 8003

CMD ["node", "src/server.js"]
