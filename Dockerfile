FROM node:22-alpine

RUN apk add --no-cache su-exec ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000

USER root
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start:api"]
