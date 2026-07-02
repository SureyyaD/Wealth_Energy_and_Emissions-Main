FROM node:23-bookworm-slim

WORKDIR /vite-app

COPY ./vite-app/package.json ./vite-app/package-lock.json ./

RUN npm ci

CMD ["sh", "-c", "echo 'Starting in development mode...' && npm run dev"]