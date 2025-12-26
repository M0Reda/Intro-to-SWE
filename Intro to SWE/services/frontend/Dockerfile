FROM node:18-alpine as build
WORKDIR /app

# Copy package.json and install deps
COPY services/frontend/package*.json ./
RUN npm install

# Copy source code
COPY services/frontend .

# Build the app
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]