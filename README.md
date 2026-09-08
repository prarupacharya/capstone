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
- Docker Desktop for the local PostgreSQL service

## Quality checks

Install dependencies and run the checks from the repository root:

```bash
npm install
npm run lint
npm run typecheck
npm test
```

Pull requests and pushes run the same lint, typecheck, and test commands through GitHub Actions.

## Docker Postges command 
docker compose up -d postgres
