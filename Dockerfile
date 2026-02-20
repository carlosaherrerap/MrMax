FROM node:20-bullseye-slim

# Install ffmpeg for audio processing
RUN apt-get update && apt-get install -y ffmpeg python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]
