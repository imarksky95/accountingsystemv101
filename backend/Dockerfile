FROM node:20-bullseye-slim

# Install Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    wget \
    gnupg \
    libgtk-3-0 \
    libxss1 \
    libasound2 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxrandr2 \
    libxfixes3 \
    libxrender1 \
    libxtst6 \
    libcups2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Ensure Puppeteer will download a compatible Chromium during npm install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=0

# Copy backend package files and install dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --only=production

# Copy backend source
COPY backend/ ./

# Use PORT from environment or default 5000
ENV PORT=5000
EXPOSE 5000

CMD ["npm", "start"]
