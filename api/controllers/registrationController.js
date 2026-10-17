/**
 * registrationController.js - the event registration resource.
 * GET lists bookings (newest first); POST creates a booking.
 * Rules enforced here: the event must be published, one email may book an event
 * only once, and ticket counts stay within capacity. The unique key in the
 * database backs these rules up at the SQL level.
 */

'use strict';

const db = require('../event_db');
const v = require('./validators');

/** Columns returned for a single registration row. */
const REG_COLUMNS = `
    r.registration_id, r.event_id, r.full_name, r.email, r.phone, r.tickets,
    r.registration_date, r.notes, r.created_at,
    e.event_name, e.slug AS event_slug, e.event_date, e.venue, e.city
`;

/* -------------------------------------------------------------------------- */
/*  GET /api/registrations                                                     */
/* -------------------------------------------------------------------------- */
async function listRegistrations(req, res, next) {
    try {
        const { event_id: eventId, limit } = req.query;

        const conditions = ['e.status = \'active\''];   // never expose a suspended event
        const params = [];

        if (eventId !== undefined && String(eventId) !== '') {
            if (!v.isPositiveInt(eventId)) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Invalid event_id. It must be a positive whole number.' }
                });
            }
            conditions.push('r.event_id = ?');
            params.push(Number(eventId));
        }

        const max = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        // Newest purchase first - this is exactly the order the event details
        // page must show ("sorted by the latest date when tickets were bought").
        const sql = `
            SELECT ${REG_COLUMNS}
            FROM event_registrations r
            INNER JOIN events e ON e.event_id = r.event_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY r.registration_date DESC, r.registration_id DESC
            LIMIT ?`;
        params.push(max);

        const rows = await db.query(sql, params);

        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/registrations/:id                                                 */
/* -------------------------------------------------------------------------- */
async function getRegistrationById(req, res, next) {
    try {
        const { id } = req.params;
        if (!v.isPositiveInt(id)) {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid registration id. It must be a positive whole number.' }
            });
        }

        const row = await db.queryOne(
            `SELECT ${REG_COLUMNS}
             FROM event_registrations r
             INNER JOIN events e ON e.event_id = r.event_id
             WHERE r.registration_id = ?`,
            [Number(id)]
        );

        if (!row) {
            return res.status(404).json({
                success: false,
                error: { message: `No registration found with id ${id}.` }
            });
        }

        res.status(200).json({ success: true, data: row });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/registrations   -  the "Register" button on the client website    */
/* -------------------------------------------------------------------------- */
async function createRegistration(req, res, next) {
    try {
        const body = req.body || {};

        // ---- 1. validate every field before touching the database -----------
        const check = v.collect([
            { field: 'event_id',  result: v.isPositiveInt(body.event_id)
                ? { valid: true }
                : { valid: false, message: 'A valid event is required.' } },
            { field: 'full_name', result: v.requiredText(body.full_name, 'Full name', 2, 120) },
            { field: 'email',     result: v.email(body.email) },
            { field: 'phone',     result: v.phone(body.phone) },
            { field: 'tickets',   result: v.integerInRange(body.tickets, 'Number of tickets', 1, 50) },
            { field: 'notes',     result: v.optionalText(body.notes, 'Notes', 255) }
        ]);

        if (!check.ok) {
            // 422 = the request was well formed but the content is not usable.
            // The browser shows these messages next to the matching inputs.
            return res.status(422).json({
                success: false,
                error: { message: 'Please fix the highlighted fields and try again.', fields: check.errors }
            });
        }

        const eventId = Number(body.event_id);

        // ---- 2. the event must exist and be open for booking ----------------
        const event = await db.queryOne(
            `SELECT e.event_id, e.event_name, e.status, e.capacity, e.event_date,
                    COALESCE((SELECT SUM(tickets) FROM event_registrations WHERE event_id = e.event_id), 0) AS tickets_taken
             FROM events e WHERE e.event_id = ?`,
            [eventId]
        );

        if (!event) {
            return res.status(404).json({
                success: false,
                error: { message: `No charity event found with id ${eventId}.` }
            });
        }
        if (event.status !== 'active') {
            return res.status(409).json({
                success: false,
                error: { message: 'This event is not open for registration.' }
            });
        }
        if (new Date(event.event_date) < new Date()) {
            return res.status(409).json({
                success: false,
                error: { message: 'This event has already finished.' }
            });
        }

        // ---- 3. do not oversell the venue ----------------------------------
        const tickets = Number(body.tickets);
        const remaining = Number(event.capacity) - Number(event.tickets_taken);
        if (remaining > 0 && tickets > remaining) {
            return res.status(409).json({
                success: false,
                error: { message: `Only ${remaining} ticket(s) are left for this event.` }
            });
        }

        // ---- 4. insert ------------------------------------------------------
        const result = await db.query(
            `INSERT INTO event_registrations
                 (event_id, full_name, email, phone, tickets, registration_date, notes)
             VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
            [
                eventId,
                v.requiredText(body.full_name, 'Full name', 2, 120).value,
                v.email(body.email).value,
                v.phone(body.phone).value,
                tickets,
                v.optionalText(body.notes, 'Notes', 255).value
            ]
        );

        const created = await db.queryOne(
            `SELECT ${REG_COLUMNS}
             FROM event_registrations r
             INNER JOIN events e ON e.event_id = r.event_id
             WHERE r.registration_id = ?`,
            [result.insertId]
        );

        // 201 Created + the canonical location of the new resource.
        res.status(201)
            .location(`/api/registrations/${result.insertId}`)
            .json({
                success: true,
                message: `Registered ${created.tickets} ticket(s) for "${created.event_name}".`,
                data: created
            });
    } catch (error) {
        // The unique key (event_id, email) rejected a second booking.
        if (error && error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                error: { message: 'This email address is already registered for this event.' }
            });
        }
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/registrations/:id   -  cancel a booking                        */
/* -------------------------------------------------------------------------- */
async function deleteRegistration(req, res, next) {
    try {
        const { id } = req.params;
        if (!v.isPositiveInt(id)) {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid registration id. It must be a positive whole number.' }
            });
        }

        const result = await db.query(
            'DELETE FROM event_registrations WHERE registration_id = ?',
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: { message: `No registration found with id ${id}.` }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Registration cancelled.'
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listRegistrations,
    getRegistrationById,
    createRegistration,
    deleteRegistration
};
