# Frontend — Reservation, Calendar & Transactions
**Branch:** `frontend-maritza` (update to your branch name)
**Author:** Maritza Medina
**Date:** July 20, 2026
**User Stories:** US 2, US 3, US 4, US 5, US 7, US 9, US 10, US 26

---

## Overview

This update connects the frontend to the backend reservation endpoints that were merged in PR #94. It adds the full reservation workflow, a calendar view, and a transactions tab — covering the complete borrowing lifecycle from request to return.

---

## New Files

| File | Description |
|------|-------------|
| `src/api/reservations.ts` | API service for all reservation endpoints — follows same pattern as `tools.ts` and `users.ts` |
| `src/pages/Reservations/RequestReservation.tsx` | US 2 — Borrower selects dates and submits a reservation request |
| `src/pages/Reservations/Transactions.tsx` | US 3,4,5,7,9,10 — Shows all reservations with action buttons (approve, deny, pickup, return, cancel) |
| `src/pages/Calendar/CalendarPage.tsx` | US 26 — Monthly calendar view of all reservations with reminder banner |

---

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Added `/tools/:toolId/reserve` and `/calendar` routes |
| `src/components/Navbar.tsx` | Added **Reserve** link (Browse Neighborhood) and updated **Calendar** to go to `/calendar` |
| `src/pages/Tools/ToolDetail.tsx` | Enabled the **Request Reservation** button — was disabled, now routes to reservation form |
| `src/pages/Dashboard/Dashboard.tsx` | Wired Transactions tab to real `<Transactions />` component, added Calendar placeholder, added success banner for reservation created |
| `tests/vitest_setup.ts` | Added localStorage mock so all tests pass in jsdom environment |
| `tests/App.test.tsx` | Added mock for `RequestReservation` page |
| `tests/Dashboard.test.tsx` | Updated to mock reservations API and test new Transactions tab behavior |
| `tests/Tooldetail.test.tsx` | Updated test — Request Reservation button is now enabled (not disabled) |
| `tests/Navbar.test.tsx` | Updated Calendar nav test to match new `/calendar` route |

---

## How the Reservation Flow Works

### Step 1 — Browse and Request (US 2)
1. Log in and click **Reserve** in the navbar
2. Browse available tools in the neighborhood
3. Click on a tool card → Tool Detail page
4. Click **Request Reservation**
5. Select start and end dates
6. Click **Submit Request**
7. Redirected to Transactions tab with success banner

### Step 2 — Owner Approves or Denies (US 4)
1. Tool owner sees the request in the **Transactions** tab
2. Clicks **Approve** or **Deny**
3. Borrower's reservation status updates automatically

### Step 3 — Borrower Confirms Pickup (US 7)
1. Borrower sees APPROVED reservation in Transactions tab
2. Clicks **Confirm Pickup**
3. Status changes to PICKED_UP

### Step 4 — Owner Confirms Return (US 5)
1. Owner sees PICKED_UP reservation in Transactions tab
2. Clicks **Confirm Return**
3. Status changes to RETURNED

### Cancel (US 3)
- Either the owner or borrower can cancel a REQUESTED or APPROVED reservation
- Cancel button is not shown for PICKED_UP, RETURNED, or already CANCELLED

---

## Calendar Page (US 26)

- Navigate to **Calendar** in the navbar → `/calendar`
- Shows a monthly grid with colored dots for each reservation
- Click any date to see reservations for that day in the detail panel
- **Reminder banner** appears for APPROVED reservations starting within 3 days
- Navigate between months with ← → arrows
- Today's date is highlighted in orange

### Status Color Legend
| Color | Status |
|-------|--------|
| Blue | REQUESTED |
| Green | APPROVED |
| Yellow | PICKED_UP |
| Purple | RETURNED |
| Red | DENIED |
| Gray | CANCELED |

---

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reservations` | Create reservation request |
| `GET` | `/api/reservations` | List all user reservations |
| `POST` | `/api/reservations/{id}/approve` | Owner approves |
| `POST` | `/api/reservations/{id}/deny` | Owner denies |
| `POST` | `/api/reservations/{id}/cancel` | Cancel reservation |
| `POST` | `/api/reservations/{id}/pickup` | Borrower confirms pickup |
| `POST` | `/api/reservations/{id}/return` | Owner confirms return |

---

## How to Test Locally

### Prerequisites
```bash
# Terminal 1 — Backend
cd ~/Desktop/Summer_project/Neighborhood-Tool-Sharing
docker compose up

# Terminal 2 — Migrations and seed
docker compose exec web alembic upgrade head
docker compose exec web python seed.py

# Terminal 3 — Frontend
cd ~/Desktop/Summer_project/Neighborhood-Tool-Sharing/frontend
npm install
npm run dev
```

### Test accounts
| Email | Password | Role |
|-------|----------|------|
| seed1@example.com | ValidPassword1! | Member (tool owner) |
| seed2@example.com | ValidPassword1! | Member (borrower) |
| seed3@example.com | ValidPassword1! | Member |
| seed4@example.com | ValidPassword1! | Member |
| admin_email@example.com | Admin1234! | Admin |

### Test the full reservation flow
1. Open Chrome — log in as `seed2@example.com` (borrower)
2. Open Safari — log in as `seed1@example.com` (owner)
3. In Chrome: click **Reserve** → click a tool → **Request Reservation** → select dates → **Submit**
4. In Safari: go to **Transactions** tab → click **Approve**
5. In Chrome: go to **Transactions** tab → click **Confirm Pickup**
6. In Safari: go to **Transactions** tab → click **Confirm Return**
7. Check the **Calendar** page — reservation should appear on the correct dates

---

## Running Tests
```bash
cd frontend
npm run lint    # 0 errors expected
npm run test    # 77/77 tests passing
```

---

## User Stories Covered

| US | Description | Where |
|----|-------------|-------|
| US 2 | Request a reservation | `RequestReservation.tsx` |
| US 3 | Cancel a reservation | `Transactions.tsx` |
| US 4 | Approve or deny reservation | `Transactions.tsx` |
| US 5 | Confirm return | `Transactions.tsx` |
| US 7 | Confirm pickup | `Transactions.tsx` |
| US 9 | Owner views lending reservations | `Transactions.tsx` |
| US 10 | Borrower views borrowing history | `Transactions.tsx` |
| US 26 Scenario 3 | Reminder for upcoming reservations | `CalendarPage.tsx` |

---

*Prepared by Maritza Medina — ICS 613 Group 1 — July 20, 2026*
