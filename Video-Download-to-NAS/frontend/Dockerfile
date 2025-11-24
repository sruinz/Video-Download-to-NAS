FROM node:18-alpine as builder

WORKDIR /app

# Copy VERSION file from server root
COPY VERSION ./VERSION

# Copy package files
COPY frontend/package*.json ./

# Copy version update script
COPY frontend/update_version.sh /app/update_version.sh
RUN chmod +x /app/update_version.sh

# Update version in package.json
RUN /app/update_version.sh

# Install dependencies
RUN npm install

# Copy source code
COPY frontend/ .

# Build the app
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
