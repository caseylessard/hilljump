FROM node:20-alpine
WORKDIR /app

# install deps
COPY package*.json ./
RUN npm ci --include=dev

# build
COPY . .
RUN npm run build

# serve the static build
RUN npm install -D serve
EXPOSE 3000
CMD ["npx","serve","-s","dist","-l","3000"]
