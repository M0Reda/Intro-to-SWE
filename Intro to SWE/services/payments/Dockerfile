FROM node:18-alpine
WORKDIR /app

# Copy shared directory
COPY shared /app/shared

# Copy package.json and install deps
COPY services/payments/package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY services/payments .

EXPOSE 3002
CMD ["node", "src/webhook.js"]