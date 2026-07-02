# Frontend — Invite & Registration Pages
**Branch:** `frontend-maritza`  
**Author:** Maritza Medina  
**Date:** July 2, 2026  
**Related PR:** #55 (Backend invitation and registration by rodin-igor)  
**User Stories:** US 11, US 12

---

## Overview

This PR adds the frontend pages for the invite-only registration flow. It connects to the backend endpoints implemented in PR #55 and covers the full US 11 and US 12 user flows.

---

## New Files

| File | Description |
|------|-------------|
| `src/pages/Invite/SendInvite.tsx` | Form for logged-in members to send an invite to a new user |
| `src/pages/Register/Register.tsx` | Registration form for new users arriving via an invite link |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Added `/invite` and `/register` routes |
| `src/pages/Dashboard/Dashboard.tsx` | Fixed field names to match API response (`user_name`, `user_email`) |
| `src/pages/Login/Login.tsx` | Connected to backend using Vite proxy and team's `auth.ts` service |

---

## How the Invite & Registration Flow Works

### Step 1 — Logged-in member sends an invite
1. Member navigates to `/invite` (protected route — must be logged in)
2. Enters the recipient's email address
3. Clicks **Send Invite**
4. Frontend calls `POST /api/invitations` with `{ recipient_email }`
5. Backend generates a token and prints the invite link to the Docker console (email not yet implemented)

```
====================
DEVELOPMENT MODE: Invitation link generated for newneighbor@example.com.
URL: ?token=H4t9ZszPwW9DLj1OQ1FNYQ
====================
```

### Step 2 — New user registers using the invite link
1. New user opens the invite link: `http://localhost:5175/register?token=<token>`
2. Frontend calls `GET /api/invitations/validate?token=<token>` to validate the token
3. If valid → registration form loads with the email **pre-filled and locked**
4. If invalid/expired/used → error message is shown
5. User enters a password and clicks **Create Account**
6. Frontend calls `POST /api/auth/register` with `{ email, password, invite_token }`
7. On success → redirects to `/login`

### Step 3 — New user logs in
1. New user logs in at `/login` with their new credentials
2. Dashboard loads with their profile data

---

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/invitations` | Send an invitation (requires JWT) |
| `GET` | `/api/invitations/validate?token=` | Validate an invite token (public) |
| `POST` | `/api/auth/register` | Create a new account using invite token (public) |
| `POST` | `/api/auth/login` | Login with email and password (public) |
| `GET` | `/api/users/me` | Get current user profile (requires JWT) |

---

## How to Test Locally

### Prerequisites
- Backend running: `docker compose up` in `Neighborhood-Tool-Sharing/`
- Migrations run: `docker compose exec web alembic upgrade head`
- Database seeded: `docker compose exec web python seed.py`
- Frontend running: `npm run dev` in `frontend-files/frontend/`

### Test the invite flow
1. Go to `http://localhost:5175/login`
2. Log in with `seed1@example.com` / `ValidPassword1!`
3. Go to `http://localhost:5175/invite`
4. Enter a new email (e.g. `newneighbor@example.com`) and click **Send Invite**
5. Copy the token from the Docker console output
6. Open `http://localhost:5175/register?token=<paste-token-here>`
7. Enter a password and click **Create Account**
8. Log in with the new account credentials

---

## Notes
- The `/invite` route is **protected** — only logged-in users can access it
- The `/register` route is **public** — anyone with a valid token can register
- Invite links are printed to the Docker console until email service is implemented
- All pages follow the team's existing Tailwind CSS + TypeScript code style
