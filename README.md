# Support Ticket API

Ticketing REST API built with Django REST Framework, PostgreSQL and JWT auth, with role-based permissions (customer / agent / admin). Emails and AI-drafted replies run in the background with Celery + Redis.

![CI](https://github.com/YOUR_USERNAME/support-ticket-api/actions/workflows/ci.yml/badge.svg)

## Features
- JWT authentication (register, login, refresh)
- Three roles with row-level access: customers see their own tickets, agents see assigned ones, admins see all
- Ticket lifecycle: create, assign (admin), update status/priority (staff), comments
- Filtering, search, ordering and pagination
- Background jobs (Celery + Redis): confirmation email, AI reply draft via the Groq API (staff-only field)
- Swagger docs, pytest suite, Docker Compose, GitHub Actions CI

## Run with Docker
1. Copy `.env.example` to `.env` and set `GROQ_API_KEY` (optional: without it, AI drafts are skipped).
2. Start everything:
   ```bash
   docker compose up --build
   docker compose exec web python manage.py createsuperuser
   ```
3. Open http://localhost:8000/api/docs/ (Swagger) or http://localhost:8000/admin/

Set a user's `role` to `agent` or `admin` in the Django admin.

## Tests
```bash
docker compose exec web python -m pytest -q
```

## Roles
| Role | Can do |
|------|--------|
| customer | Register, create tickets, see own tickets, comment |
| agent | See assigned tickets, update status/priority, comment, see AI drafts |
| admin | See all, assign tickets to agents, delete, see AI drafts |

## Endpoints
| Method | URL | Notes |
|--------|-----|-------|
| POST | /api/auth/register/ | Public signup (always a customer) |
| POST | /api/auth/token/ | JWT login |
| POST | /api/auth/token/refresh/ | Refresh token |
| GET | /api/auth/me/ | Current user |
| GET/POST | /api/tickets/ | List (filter, search, paginate) / create |
| GET/PATCH/DELETE | /api/tickets/{id}/ | Detail / update (staff) / delete (admin) |
| POST | /api/tickets/{id}/assign/ | Admin only, body: `{"agent_id": 2}` |
| GET/POST | /api/tickets/{id}/comments/ | Comments |

Filters: `?status=open&priority=high&assigned_to=2&search=login&ordering=-created_at`

## Tech
Python 3.13, Django, Django REST Framework, SimpleJWT, PostgreSQL, Celery, Redis, Docker, pytest, GitHub Actions