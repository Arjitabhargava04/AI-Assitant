# ============================================
# STAGE 1: Build React app with Node.js
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (for Docker cache)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all frontend code
COPY . .

# Build for production (uses .env.production automatically)
RUN npm run build

# ============================================
# STAGE 2: Serve built files with Nginx
# ============================================
FROM nginx:alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Nginx starts automatically
CMD ["nginx", "-g", "daemon off;"]