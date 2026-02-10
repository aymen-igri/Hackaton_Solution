FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 8004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8004/health/live || exit 1

# Start the service
CMD ["node", "src/server.js"]
