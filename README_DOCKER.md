# Docker setup for Shay_Project

This repository contains two services: the Node backend and a static frontend.

Files added:
- `backend/Dockerfile` - Dockerfile for the Node backend. Uses Node 20 and copies production dependencies.
- `backend/.dockerignore` - ignores node_modules and .env
- `frontend/Dockerfile` - nginx-based image serving the static `career_advisor_appV2.html` and `app.js`.
- `frontend/.dockerignore` - ignores node_modules
- `docker-compose.yml` - builds and runs both services together

How to run locally

1. Make sure Docker and docker-compose are installed.
2. Copy the example env file for Docker and fill real values:

```bash
cp backend/.env.docker.example backend/.env.docker
# Edit backend/.env.docker and set your real OPENAI_API_KEY and any other values
```

3. Start services from the project root:

```bash
docker compose up --build
```

3. After build:
- Backend will be available at http://localhost:3000
- Frontend will be available at http://localhost:8080

Notes
- The backend service reads environment variables from `backend/.env`. Do NOT commit secrets to git. The `backend/Dockerfile` intentionally does not bake `.env` into the image.
- If you change frontend paths, ensure `index.html` (here `career_advisor_appV2.html`) references `app.js` with a relative path.

Optional: Running only one service

```bash
docker compose up --build backend
# or
docker compose up --build frontend
```

Troubleshooting
- If the backend cannot connect to the database, ensure the database host in `backend/.env` is reachable from within Docker (if using host MySQL, on macOS use host.docker.internal or run MySQL in Docker and link it).
- To rebuild images after changes, use `docker compose build --no-cache`.

Useful commands to diagnose issues:

```bash
# Show service status
docker compose ps --all

# Tail backend logs
docker compose logs -f backend

# Show mysql logs
docker compose logs -f mysql

# Validate compose file
docker compose config
```

If you want, I can also:
- Add a lightweight MySQL service to docker-compose for local development.
- Add healthchecks and a non-root nginx user for the frontend image.
