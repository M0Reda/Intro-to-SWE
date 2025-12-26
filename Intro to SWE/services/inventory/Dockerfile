FROM node:18-alpine
WORKDIR /app

# Copy shared directory
COPY shared /app/shared

# Copy package.json and install deps
COPY services/inventory/package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY services/inventory .

EXPOSE 3004
CMD ["node", "src/index.js"]