# Capstone

Full-stack monorepo foundation for a NestJS backend and React/Vite frontend.

## Repository layout

```text
packages/
  backend/   # NestJS application
  frontend/  # React/Vite application
```

The workspace uses `packages/*`, so either application can be added without changing the repository layout.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop for the full local stack

## Local development

Install dependencies, start PostgreSQL, and run both applications from the repository root:

```bash
npm install
npm run db:up
npm run dev
```

The backend runs on `http://localhost:3000` and the frontend runs on `http://localhost:5173`.
Stop the development processes with `Ctrl+C`, then stop PostgreSQL when needed:

```bash
npm run db:down
```

When the backend runs on the host, copy `packages/backend/.env.example` to
`packages/backend/.env` and use `DATABASE_HOST=localhost`. A backend running inside
Docker should use the Compose service name `DATABASE_HOST=postgres`. Frontend settings
can be configured in `packages/frontend/.env` from its example file.

## Run the complete stack with Docker

To build and start PostgreSQL, the backend, and the frontend together:

```bash
docker compose up --build
```

Open the frontend at `http://localhost:5173`. Compose waits for PostgreSQL and the
backend health check before starting the frontend. Stop all containers with:

```bash
docker compose down
```

The Docker backend uses `DATABASE_HOST=postgres` for the Compose network. The browser
uses the published backend URL, `http://localhost:3000`, when the frontend image is built.

## Quality checks

Install dependencies and run the checks from the repository root:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Pull requests and pushes run the same lint, typecheck, and test commands through GitHub Actions.

