FROM node:18-alpine
WORKDIR /app

# Copy shared directory
COPY shared /app/shared

# Copy package.json and install deps
COPY services/inventory/package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY services/inventory .

# Install a process manager to run multiple processes
RUN npm install -g concurrently

EXPOSE 3004

# Run both the API server and the RabbitMQ consumer
CMD ["npx", "concurrently", "node src/index.js", "node src/consumer.js"]