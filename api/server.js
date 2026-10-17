/**
 * server.js - Express entry point for the Charity Events API.
 * Sets up CORS, basic security headers, request logging and rate limiting, then
 * mounts the event routes. Run with `npm start` (or `npm run dev` for reload).
 */

'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const db = require('./event_db');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Shared hosting (cPanel + Passenger) mounts the app under a sub-path such as
// /apiapp and forwards the FULL URI to Express. The routers below expect paths
// starting with /api, so the prefix must be stripped first. Set
// SUBPATH_PREFIX=/apiapp in the hosting environment; locally it stays empty
// and this middleware is skipped entirely.
const SUBPATH_PREFIX = (process.env.SUBPATH_PREFIX || '').replace(/\/+$/, '');
if (SUBPATH_PREFIX) {
    app.use((req, res, next) => {
        if (req.url === SUBPATH_PREFIX) {
            req.url = '/';
        } else if (req.url.startsWith(SUBPATH_PREFIX + '/')) {
            req.url = req.url.slice(SUBPATH_PREFIX.length);
        }
        next();
    });
}

/* -------------------------------------------------------------------------- */
/*  Middleware (applied, in order, to every request)                           */
/* -------------------------------------------------------------------------- */

// 1. Security headers (XSS protection, MIME sniffing, frame options, ...).
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. CORS - in Assessment 2 the client-side site is served from a different
//    origin (http://localhost:5500), so cross-origin reads must be allowed.
//    The allowed origin list is configurable through ALLOWED_ORIGINS in .env so
//    the API is not wide open once it is deployed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Requests with no Origin header (Postman, curl, server-to-server) are allowed.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    // Assessment 3 needs the full C.R.U.D. cycle: the admin site creates,
    // updates and deletes events, and the public registration page posts.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Request logging (short, coloured, development friendly).
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 4. Body parsers - included so the POST endpoints added in Assessment 3 work
//    without touching this file again.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 5. Basic abuse protection: one IP may not hammer the API.
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 300,                   // limit each IP to 300 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests from this IP, please try again later.' } }
}));

/* -------------------------------------------------------------------------- */
/*  Routes                                                                     */
/* -------------------------------------------------------------------------- */

// Simple health probe - useful for Postman and for the client's status badge.
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Charity Events API is running',
        version: '1.0.0',
        time: new Date().toISOString()
    });
});

// Everything else lives in routes/eventRoutes.js
app.use('/api', eventRoutes);

// Root route: a tiny self-documenting index so anyone opening
// http://localhost:3000 in a browser sees what the API offers.
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'PROG2002 A3 - Charity Events API (client-side + admin-side)',
        endpoints: [
            'GET    /api/health',
            'GET    /api/events?scope=upcoming|past|all&limit=50&sort=date|date-desc|progress|raised|name',
            'GET    /api/events/featured?limit=3',
            'GET    /api/events/search?q=&category=&location=&from=&to=&free=&sort=',
            'GET    /api/events/admin?status=&q=            <- ALL statuses (admin list)',
            'POST   /api/events                            <- CREATE (Part 2)',
            'GET    /api/events/:id                        <- event + registrations (Part 2)',
            'PUT    /api/events/:id                        <- UPDATE (Part 2)',
            'DELETE /api/events/:id                        <- DELETE, 409 if booked (Part 2)',
            'GET    /api/registrations?event_id=',
            'POST   /api/registrations                     <- public booking (Part 3)',
            'GET    /api/registrations/:id',
            'DELETE /api/registrations/:id',
            'GET    /api/weather?event_id=1                <- Open-Meteo (Part 6, optional)',
            'GET    /api/categories',
            'GET    /api/organisations',
            'GET    /api/donations/recent?limit=12',
            'GET    /api/stats'
        ]
    });
});

/* -------------------------------------------------------------------------- */
/*  404 + centralised error handling                                           */
/* -------------------------------------------------------------------------- */

// Unknown route -> JSON 404 (never an HTML page, this is an API).
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: { message: `Endpoint not found: ${req.method} ${req.originalUrl}` }
    });
});

// Any error passed to next() (or thrown inside an async handler) lands here.
// The stack trace is only exposed while developing.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const isCorsError = err && /not allowed by CORS/.test(err.message);

    if (!isCorsError) {
        console.error('[server] Unhandled error:', err);
    }

    res.status(isCorsError ? 403 : 500).json({
        success: false,
        error: {
            message: isCorsError
                ? err.message
                : (process.env.NODE_ENV === 'production'
                    ? 'An internal server error occurred.'
                    : err.message)
        }
    });
});

/* -------------------------------------------------------------------------- */
/*  Start-up                                                                   */
/* -------------------------------------------------------------------------- */

async function start() {
    const connected = await db.testConnection();
    if (!connected) {
        console.error('[server] Exiting: could not reach the MySQL database.');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log('');
        console.log('  ============================================================');
        console.log('   PROG2002 A2 - Charity Events API');
        console.log(`   listening on http://localhost:${PORT}`);
        console.log(`   try:  http://localhost:${PORT}/api/events`);
        console.log('  ============================================================');
        console.log('');
    });
}

// Release the pool when the process is stopped with Ctrl+C.
process.on('SIGINT', async () => {
    console.log('\n[server] SIGINT received - closing database pool...');
    await db.closePool();
    process.exit(0);
});

start();

module.exports = app;
