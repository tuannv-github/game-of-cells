# Use Node.js 20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the Vite port
EXPOSE 5173

# Run Vite in dev mode with host flag to allow external access
CMD ["npm", "run", "dev", "--", "--host"]
