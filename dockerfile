FROM node:20-alpine

WORKDIR /app

# install deps
COPY package*.json ./
RUN npm ci --include=dev

# copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npx","next","start","-p","3000"]
