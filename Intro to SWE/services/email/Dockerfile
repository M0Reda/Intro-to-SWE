FROM node:18-alpine
WORKDIR /app

# Copy package.json and install deps
COPY services/email/package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY services/email .

CMD ["node", "src/sendEmail.js"]