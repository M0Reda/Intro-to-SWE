FROM node:18-alpine
WORKDIR /app

# Copy shared directory
COPY shared /app/shared

# Copy package.json and install deps
COPY services/cart/package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY services/cart .

EXPOSE 3005
CMD ["node", "src/index.js"]