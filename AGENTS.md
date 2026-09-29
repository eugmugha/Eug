# Marketplace — PWA (Python/FastAPI + PostgreSQL)

## Stack
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL. Passwords hashed with bcrypt, JWT auth.
- **Frontend**: Static HTML/CSS/JS PWA served by FastAPI (single origin, port 3000). No build step.
- **DB**: PostgreSQL 16 in docker compose.

## Running
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- App: http://localhost:3000
- API docs: http://localhost:3000/docs

## Admin access
- Default admin seeded on startup: `admin@marketplace.com` / `admin123`
- Override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.

## Key details
- Tables auto-created on startup (`Base.metadata.create_all`). No migration system — schema changes require dropping/recreating tables or adding Alembic.
- Uniqueness enforced at DB level: `email` and `business_name` are unique columns.
- Frontend is served by `StaticFiles(directory="frontend", html=True)` mounted last so `/api/*` routes take priority.
- `uvicorn --reload` watches `/app/backend` for live reload.

## Verification
- `curl http://localhost:3000/api/health` → `{"status":"ok"}`
- Register a user via `/register.html`, then log into `/admin.html` to see stats + user records.
