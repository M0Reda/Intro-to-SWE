FROM node:18-alpine
WORKDIR /app

# Copy shared directory
COPY shared /app/shared

# Copy package.json and install deps
COPY services/orders/package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY services/orders .

EXPOSE 3000
CMD ["node", "src/index.js"]