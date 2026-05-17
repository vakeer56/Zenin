FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install everything to build
RUN npm run install:all

# Copy source code
COPY . .

# Build client
WORKDIR /app/client
RUN npm run build

# Build server
WORKDIR /app/server
RUN npm run build

# Move back to root
WORKDIR /app

# Expose port
EXPOSE 5000

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000
ENV CLIENT_URL=http://localhost:5000

# Start the server
WORKDIR /app/server
CMD ["npm", "start"]
