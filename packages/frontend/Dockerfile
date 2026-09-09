FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/frontend ./packages/frontend

RUN npm run build --workspace frontend


FROM nginx:1.27-alpine

COPY --from=build \
    --chown=nginx:nginx \
    /app/packages/frontend/dist \
    /usr/share/nginx/html

RUN sed -i 's/listen[[:space:]]*80;/listen 8080;/' /etc/nginx/conf.d/default.conf \
    && sed -i 's|pid[[:space:]]*/run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
    && sed -i '/^[[:space:]]*user[[:space:]]/d' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx \
        /var/cache/nginx \
        /var/log/nginx \
        /etc/nginx/conf.d

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]