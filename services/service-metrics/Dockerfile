FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 8005

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8005/health', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
