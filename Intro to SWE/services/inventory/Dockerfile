FROM node:18-alpine
WORKDIR /app

# Copy package.json and install deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

EXPOSE 3004
CMD ["node", "src/index.js"]
