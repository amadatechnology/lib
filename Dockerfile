FROM node:alpine3.18

WORKDIR /app

# Install build dependencies for bcrypt
RUN apk --no-cache add python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start"]
