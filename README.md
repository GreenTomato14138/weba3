# PROG2002 — Assessment 3: Complete Dynamic Website

**Charity Events (Guangxi, China)** — Angular 22 client-side site + Angular 22 admin-side site + RESTful API

| | |
|---|---|
| Unit | PROG2002 Web Development II |
| Assessment | A3 — Complete dynamic website (40%) |
| Student | Boyuan Liu (24832410) |
| Case study | Guangxi Charity Events (continued from Assessment 2) |
| Stack | Node.js, Express, MySQL, HTML, CSS, **TypeScript + Angular 22**, Open-Meteo weather API |

---

## 1. What is in this repository

```
├── api/                      ← the Node.js + Express REST API (backend)
│   ├── server.js             entry point, middleware, CORS, error handling
│   ├── event_db.js           MySQL connection pool (single place for all SQL config)
│   ├── controllers/
│   │   ├── eventsController.js        public read endpoints (list/search/detail)
│   │   ├── registrationController.js  event bookings (Part 3)
│   │   ├── adminController.js         event C.R.U.D. (Part 2 / Part 4)
│   │   ├── weatherController.js       Open-Meteo external API (Part 6 bonus)
│   │   └── validators.js              shared input validation
│   ├── routes/eventRoutes.js all endpoint definitions
│   └── database/charityevents_a3_db.sql   ← ONE self-contained SQL file
│
├── clientside/               ← the public website (Angular 22 standalone app)
│   └── src/app/
│       ├── home/             carousel, categories, live stats (signals)
│       ├── search/           Reactive Forms filters + date validation
│       ├── event-detail/     details + who-has-booked + weather strip
│       ├── register/         validated registration form + confirmation
│       ├── shared/event-card reusable event card component
│       ├── models/           TypeScript interfaces for all API data
│       └── services/         typed HttpClient services (api/event/registration/weather)
│
└── adminside/                ← the staff console (second Angular 22 app)
    └── src/app/
        ├── event-list/       list of ALL events (incl. suspended) + delete
        ├── event-form/       create / edit form (shared by both modes)
        └── registrations/    view bookings per event
```

## 2. API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/events` | all active events (view with registration counts) |
| GET | `/api/events/search?q=&location=&date=&category=` | filtered search |
| GET | `/api/events/:id` | one event + its registrations (newest first) |
| POST | `/api/registrations` | book a place (validated, duplicate-safe) |
| GET | `/api/events/admin` | all events incl. suspended (admin) |
| POST | `/api/events/admin` | create event |
| PUT | `/api/events/admin/:id` | update event |
| DELETE | `/api/events/admin/:id` | delete event (409 if it has bookings) |
| GET | `/api/weather?lat=&lon=` | 7-day forecast via Open-Meteo (external API) |

## 3. How to run locally

```bash
# 1) Database — import the SQL file into MySQL
mysql -u root -p < api/database/charityevents_a3_db.sql

# 2) API — install and start (port 3000)
cd api
cp .env.example .env        # then edit DB credentials
npm install
npm start

# 3) Client site (port 4200)
cd clientside
npm install
npm start

# 4) Admin site (port 4300)
cd adminside
npm install
npm start
```

Open http://localhost:4200 for the public site and http://localhost:4300 for the staff console.

## 4. Notes

- `api/.env` is git-ignored on purpose — copy `.env.example` and fill in your own MySQL credentials.
- `node_modules/`, `dist/` and `.angular/` are git-ignored build artefacts.
- See `DEPLOYMENT.md` for cPanel deployment notes.
