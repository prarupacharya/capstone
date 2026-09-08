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

COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html

EXPOSE 80
