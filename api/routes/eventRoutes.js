/**
 * ============================================================================
 *  eventRoutes.js - RESTful route definitions for the charity events API
 *  PROG2002 (Web Development II) - Assessment 3
 *  Student : Boyuan Liu (24832410)
 *
 *  All routes are mounted under /api by server.js.
 *
 *  ROUTE ORDER MATTERS
 *  -------------------
 *  Express matches routes top to bottom, so every literal path must be
 *  declared BEFORE the parameterised /events/:id. Otherwise "featured",
 *  "search" and "admin" would be parsed as an event id and never run.
 *
 *  FULL ENDPOINT MAP (Assessment 3)
 *  --------------------------------
 *  GET    /api/events                  public event feed
 *  GET    /api/events/featured         home page carousel
 *  GET    /api/events/search           search page filters
 *  GET    /api/events/admin            ADMIN list - every status (Part 4)
 *  POST   /api/events                  CREATE  (Part 2)
 *  GET    /api/events/:id              READ one + its registrations (Part 2/3)
 *  PUT    /api/events/:id              UPDATE  (Part 2)
 *  DELETE /api/events/:id              DELETE  (Part 2, blocked if booked)
 *  GET    /api/registrations           list bookings
 *  POST   /api/registrations           create booking (Part 3 page)
 *  GET    /api/registrations/:id       read booking
 *  DELETE /api/registrations/:id       cancel booking
 *  GET    /api/weather?event_id=       Open-Meteo forecast (Part 6, optional)
 * ============================================================================
 */

'use strict';

const express = require('express');

const events = require('../controllers/eventsController');
const admin = require('../controllers/adminController');
const registrations = require('../controllers/registrationController');
const weather = require('../controllers/weatherController');

const router = express.Router();

/* ------------------------- events collection (literal paths FIRST) --------- */

// GET /api/events?scope=upcoming|past|all&limit=50&sort=date
router.get('/events', events.listEvents);

// GET /api/events/featured?limit=3
router.get('/events/featured', events.listFeatured);

// GET /api/events/search?q=&category=&location=&from=&to=&free=&sort=
router.get('/events/search', events.searchEvents);

// GET /api/events/admin  -  ADMIN-ONLY LIST. Returns every event regardless of
// status (active, past AND suspended), which is what Part 4 requires.
router.get('/events/admin', admin.listAllEvents);

// POST /api/events  -  insert a new charity event (Part 2 / Part 4 "New")
router.post('/events', admin.createEvent);

/* --------------------------- events by id ---------------------------------- */

// GET /api/events/:id  -  event + its registrations, newest purchase first
router.get('/events/:id', events.getEventById);

// PUT /api/events/:id  -  update an existing event by its unique id
router.put('/events/:id', admin.updateEvent);

// DELETE /api/events/:id  -  blocked with 409 when registrations exist
router.delete('/events/:id', admin.deleteEvent);

/* --------------------------- registrations -------------------------------- */

// GET /api/registrations?event_id=&limit=
router.get('/registrations', registrations.listRegistrations);

// POST /api/registrations  -  the client "Register" form submits here
router.post('/registrations', registrations.createRegistration);

// GET /api/registrations/:id
router.get('/registrations/:id', registrations.getRegistrationById);

// DELETE /api/registrations/:id  -  cancel a booking
router.delete('/registrations/:id', registrations.deleteRegistration);

/* ------------------- external API (Part 6, optional extra) ----------------- */

// GET /api/weather?event_id=1  -  Open-Meteo forecast for the event venue
router.get('/weather', weather.getEventWeather);

/* --------------------------- supporting resources -------------------------- */

// GET /api/donations/recent?limit=12 - supporter ticker on the home page
router.get('/donations/recent', events.listRecentDonations);

// GET /api/categories  - populates the search filters AND the admin forms
router.get('/categories', events.listCategories);

// GET /api/organisations - the charities behind the events (admin form too)
router.get('/organisations', events.listOrganisations);

// GET /api/stats - headline impact figures
router.get('/stats', events.getStats);

module.exports = router;
