FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --production

FROM node:18-alpine

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

USER nodejs

EXPOSE 8005

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8005/health', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
