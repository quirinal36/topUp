# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Café Prepaid Management System (카페 선결제 관리 시스템) - A full-stack web application for managing prepaid customer balances, tracking charges/deductions, and providing analytics for small cafes.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Zustand (state) + React Router v6
- **Backend:** FastAPI + Pydantic v2 + Supabase (PostgreSQL)
- **Deployment:** Vercel (frontend as static SPA, backend via Mangum serverless adapter)

## Development Commands

### Full Stack
```bash
./start.sh              # Start both backend (port 8000) and frontend (port 5173)
```

### Frontend (from `/frontend`)
```bash
npm run dev             # Vite dev server
npm run build           # Production build
npm run lint            # ESLint with strict settings
```

### Backend (from `/backend`)
```bash
python main.py          # Run with uvicorn + reload
```

### API Documentation
- Local: http://localhost:8000/docs (FastAPI auto-generated)

## Architecture

### Directory Structure
```
api/index.py           # Vercel serverless entry (Mangum wrapper)
backend/app/
  ├── config.py        # Pydantic Settings (env vars)
  ├── database.py      # Supabase client initialization
  ├── models/          # Pydantic data models
  ├── schemas/         # Request/Response validation
  ├── routers/         # API endpoints (auth, customers, transactions, dashboard)
  └── services/        # Business logic (auth_service, pin_service)
frontend/src/
  ├── pages/           # Route components
  ├── components/      # Reusable UI components
  ├── api/             # Axios client + endpoint functions
  ├── stores/          # Zustand state (authStore with persistence)
  └── types/           # TypeScript definitions
```

### Key Patterns

**Backend:**
- Layered architecture: Routers → Services → Models
- FastAPI `Depends()` for dependency injection
- `get_current_shop()` dependency protects routes with JWT auth
- Two Supabase clients: normal (respects RLS) and admin (bypasses RLS for auth operations)
- PIN service implements rate limiting (5 failed attempts → 1 minute lockout)

**Frontend:**
- Zustand store persisted to localStorage
- Axios client auto-injects Bearer token and handles 401 → logout
- All data is shop-scoped (multi-tenant design)

### Authentication Flow
1. Username/password login with NICE identity verification on registration
2. Backend issues JWT for session (7-day expiry)
3. Frontend stores token in Zustand (persisted to localStorage)
4. Protected routes check token, redirect to login if missing
5. PIN verification required for sensitive operations (charge/deduct)

### Registration Flow (4-step)
1. Account info: Username (4-20 chars, lowercase + numbers) + password
2. Shop info: Shop name + optional email (for password reset)
3. Identity verification: NICE 본인인증 (CI stored for duplicate prevention)
4. Final: Cloudflare Turnstile bot protection + registration complete

## Database (Supabase)

Tables: `shops`, `customers`, `transactions`, `menus`, `subscriptions`, `payment_history`, `token_blacklist`

All customer/transaction data is scoped by `shop_id` for multi-tenant isolation.

## Environment Variables

Backend requires (in `.env`):
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`
- `JWT_SECRET_KEY`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` (email service)
- `TURNSTILE_SECRET_KEY` (bot protection, optional for dev)
- `NICE_MODE`, `NICE_SITE_CODE`, `NICE_SITE_PW` (identity verification)
- `FRONTEND_URL`, `CORS_ORIGINS`

Frontend requires (in `.env`):
- `VITE_TURNSTILE_SITE_KEY` (Cloudflare Turnstile)

## API Routes

- `/api/auth/*` - Username/password login, registration with NICE verification, PIN management
- `/api/customers/*` - Customer CRUD, balance tracking
- `/api/transactions/*` - Charge/deduct operations, cancellation
- `/api/dashboard/*` - Analytics and summaries

## MCP Integration

`.mcp.json` configures: Supabase MCP, Atlassian Confluence, Atlassian Jira

## Reference Documents

- `PRD.md` - Complete product requirements (Korean)
- `docs/JIRA_PROJECT_STATUS.md` - Project status
- `docs/JIRA_AGILE_BACKLOG.md` - Sprint planning
