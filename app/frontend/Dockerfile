# Build stage
FROM node:20 AS builder

WORKDIR /app

# Copy package.json without platform-specific Windows lockfile
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Production serve stage using Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
