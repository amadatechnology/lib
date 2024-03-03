# Use an official Node.js runtime as a parent image
FROM node:alpine3.18

# Set the working directory in the container
WORKDIR /app

# Install build dependencies for bcrypt
RUN apk --no-cache add python3 make g++

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Make port 3001 available to the world outside this container
EXPOSE 3001

# Run your application
CMD ["npm", "run", "start"]
