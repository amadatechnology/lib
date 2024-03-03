FROM node:alpine3.18
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN apk --no-cache add python3 make g++
RUN npm rebuild bcrypt --build-from-source
EXPOSE 3001
CMD [ "npm", "run", "start" ]
