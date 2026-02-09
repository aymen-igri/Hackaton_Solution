FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm i

COPY src/ ./src/

RUN npm run build

