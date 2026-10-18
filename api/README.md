# Charity Events API — PROG2002 Assessment 3 (Parts 1, 2 & 6)

RESTful API layer for the *Charity Events* case study, built with **Node.js +
Express + MySQL**. Student: **Boyuan Liu (24832410)**.

```
clientside/  ─┐
              ├─fetch()─▶  Express API  ──SQL──▶  MySQL (charityevents_a3_db)
adminside/   ─┘           (this folder)         (database/charityevents_a3_db.sql)
```

## 1. Files

| File | Purpose |
| --- | --- |
| `event_db.js` | MySQL connection pool; `query()` / `queryOne()` / `getConnection()` / `testConnection()`. All credentials come from `.env`. |
| `server.js` | Express app: helmet, CORS (**now allows POST/PUT/DELETE**), morgan, rate limit, routes, 404 + central error handler. |
| `routes/eventRoutes.js` | Every `/api` route, ordered so literal paths beat `/events/:id`. |
| `controllers/eventsController.js` | Public read endpoints. `getEventById` also returns the event's registrations. |
| `controllers/registrationController.js` | Bookings — list, read, create, cancel. |
| `controllers/adminController.js` | Event C.R.U.D. — list-all, create, update, delete (with the integrity rule). |
| `controllers/weatherController.js` | Open-Meteo external API proxy (Part 6). |
| `controllers/validators.js` | Shared input validation for every write endpoint. |
| `database/charityevents_a3_db.sql` | Complete schema + view + seed data in **one** file. |
| `.env.example` | Template for the environment file. |

## 2. Setup

```bash
npm install
cp .env.example .env        # then set DB_USER / DB_PASSWORD
mysql -u root -p < database/charityevents_a3_db.sql
npm start                   # http://localhost:3000/api
```

> On this machine MySQL listens on **3307**, not the usual 3306. Confirm yours
> with `mysql -u root -p -e "SELECT @@port;"` and set `DB_PORT` to match.

## 3. Endpoints

### Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | liveness probe |
| GET | `/api/events?scope=upcoming\|past\|all&limit=&sort=` | public feed (active only) |
| GET | `/api/events/featured?limit=3` | home-page carousel |
| GET | `/api/events/search?q=&category=&location=&from=&to=&free=&sort=` | search page |
| GET | `/api/events/:id` | event **+ its registrations** (newest first) |
| GET | `/api/categories` | category filter + admin form |
| GET | `/api/organisations` | charity list + admin form |
| GET | `/api/donations/recent?limit=12` | supporter ticker |
| GET | `/api/stats` | headline counters |

### Admin / writes (Part 2)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/events/admin?status=&q=&sort=` | **all** statuses incl. suspended |
| POST | `/api/events` | create — 201 + `Location` header |
| PUT | `/api/events/:id` | update by unique id |
| DELETE | `/api/events/:id` | **409** when the event has registrations |

### Registrations

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/registrations?event_id=&limit=` | newest first |
| POST | `/api/registrations` | public booking — 409 if that email already booked that event |
| GET | `/api/registrations/:id` | one booking |
| DELETE | `/api/registrations/:id` | cancel a booking |

### External API (Part 6, optional)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/weather?event_id=1` | Open-Meteo forecast, decoded into plain English |

## 4. Conventions

* **Envelope** — every response is `{ success, ... }`; errors add
  `{ error: { message } }` and, for validation failures, `{ error: { fields } }`.
* **Status codes** — 200 read · 201 created · 400 bad id · 404 not found ·
  409 conflict (duplicate booking, event already booked) · 422 validation ·
  502/504 upstream weather failure.
* **Security** — every SQL statement uses `?` placeholders executed through
  `pool.execute()`; all request bodies pass `validators.js` before use.
* **Delete integrity** — enforced twice: an explicit count check that returns a
  friendly 409, and a `ON DELETE RESTRICT` foreign key as the hard guarantee.
