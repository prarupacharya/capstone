FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY types ./types
COPY packages/backend ./packages/backend

RUN npm run build --workspace backend


FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

RUN npm ci --omit=dev

COPY --from=build /app/packages/backend/dist ./packages/backend/dist

# Create writable log directory for the non-root node user
RUN mkdir -p /app/packages/backend/logs \
    && chown -R node:node /app/packages/backend/logs

EXPOSE 3000

USER node

CMD ["npm", "run", "start", "--workspace", "backend"]