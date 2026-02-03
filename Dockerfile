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

# Expose the UI and API ports
EXPOSE 40000
EXPOSE 40001

# Run the combined frontend and backend in dev mode
CMD ["npm", "run", "dev:full"]
