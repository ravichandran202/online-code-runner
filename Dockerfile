FROM node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    golang \
    openjdk-17-jdk \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy source
COPY . .

# Expose port
EXPOSE 2000

# Start application
CMD ["node", "src/index.js"]
