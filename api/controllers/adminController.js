/**
 * adminController.js - create, update and delete events for the admin site.
 * GET /api/events/admin returns every event (all statuses) for the admin list.
 * Deleting an event is blocked when it already has registrations; the foreign
 * key (ON DELETE RESTRICT) enforces the same rule at the database level.
 */

'use strict';

const db = require('../event_db');
const v = require('./validators');

/** Every column the admin list and the edit form need. */
const ADMIN_COLUMNS = `
    event_id, event_name, slug, summary, full_description, event_date, end_date,
    venue, address, suburb, city, ticket_price, is_free, goal_amount, capacity,
    image_url, status, suspension_reason, latitude, longitude,
    category_id, category_name, category_slug, category_icon, category_colour,
    organisation_id, organisation_name, organisation_colour,
    raised_amount, supporter_count, progress_pct,
    registration_count, tickets_taken, capacity_pct,
    days_remaining, event_status, created_at, updated_at
`;

/**
 * Turns "Nanning Yongjiang Sunrise Fun Run" into
 * "nanning-yongjiang-sunrise-fun-run". Slugs must be unique, so when a clash
 * happens we append -2, -3 ... until the slug is free.
 */
async function makeUniqueSlug(name, ignoreEventId = null) {
    const base = String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 160) || 'event';

    let candidate = base;
    let suffix = 1;

    // Loop until we find a slug no other event is using.
    for (;;) {
        const params = [candidate];
        let sql = 'SELECT event_id FROM events WHERE slug = ?';
        if (ignoreEventId) {
            sql += ' AND event_id <> ?';
            params.push(ignoreEventId);
        }
        const existing = await db.queryOne(sql, params);
        if (!existing) return candidate;
        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/events/admin                                                      */
/*  The admin list must show ALL events "regardless of their status            *
 *  (Active, Past, Suspended)" - so unlike every public endpoint this one does *
 *  NOT filter on status = 'active'.                                           */
/* -------------------------------------------------------------------------- */
async function listAllEvents(req, res, next) {
    try {
        const { status, q, organisation, category, sort } = req.query;

        const conditions = [];      // <- deliberately empty: no status filter
        const params = [];

        if (status && String(status).trim() !== '') {
            // 'active' | 'suspended' | 'upcoming' | 'past' (the derived status)
            const value = String(status).trim().toLowerCase();
            if (!['active', 'suspended', 'upcoming', 'past'].includes(value)) {
                return res.status(400).json({
                    success: false,
                    error: { message: "Invalid 'status'. Use one of: active, suspended, upcoming, past." }
                });
            }
            // Filter on the real `status` column and `event_date` rather than the
            // view's derived `event_status` label. Comparing a real column
            // against a bound parameter avoids collation issues on any server.
            if (value === 'suspended') {
                conditions.push('status = ?');
                params.push('suspended');
            } else if (value === 'active') {
                conditions.push('status = ?');
                params.push('active');
            } else if (value === 'upcoming') {
                conditions.push("status = 'active' AND event_date >= CURDATE()");
            } else { // past
                conditions.push("status = 'active' AND event_date < CURDATE()");
            }
        }

        if (q && String(q).trim() !== '') {
            conditions.push('(event_name LIKE ? OR venue LIKE ? OR city LIKE ? OR suburb LIKE ?)');
            const like = `%${String(q).trim()}%`;
            params.push(like, like, like, like);
        }

        if (organisation && v.isPositiveInt(organisation)) {
            conditions.push('organisation_id = ?');
            params.push(Number(organisation));
        }

        if (category && v.isPositiveInt(category)) {
            conditions.push('category_id = ?');
            params.push(Number(category));
        }

        const orderBy = {
            'date': 'event_date ASC',
            'date-desc': 'event_date DESC',
            'name': 'event_name ASC',
            'progress': 'progress_pct DESC',
            'raised': 'raised_amount DESC',
            'tickets': 'tickets_taken DESC'
        }[String(sort || 'date').toLowerCase()] || 'event_date ASC';

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT ${ADMIN_COLUMNS} FROM vw_event_list ${where} ORDER BY ${orderBy}`;

        const events = await db.query(sql, params);

        // A small summary block so the dashboard counters need no second call.
        // Same collation-safe approach: derive the three buckets from the
        // `status` column and `event_date` instead of the derived label.
        const summary = await db.queryOne(`
            SELECT
                COUNT(*)                                            AS total_events,
                SUM(CASE WHEN status = 'active'
                          AND event_date >= CURDATE() THEN 1 ELSE 0 END) AS upcoming_events,
                SUM(CASE WHEN status = 'active'
                          AND event_date <  CURDATE() THEN 1 ELSE 0 END) AS past_events,
                SUM(CASE WHEN status = 'suspended'   THEN 1 ELSE 0 END) AS suspended_events,
                COALESCE(SUM(registration_count), 0)                AS total_registrations,
                COALESCE(SUM(tickets_taken), 0)                     AS total_tickets,
                COALESCE(SUM(raised_amount), 0)                     AS total_raised
            FROM vw_event_list`);

        res.status(200).json({
            success: true,
            count: events.length,
            summary: {
                total_events: Number(summary.total_events),
                upcoming_events: Number(summary.upcoming_events),
                past_events: Number(summary.past_events),
                suspended_events: Number(summary.suspended_events),
                total_registrations: Number(summary.total_registrations),
                total_tickets: Number(summary.total_tickets),
                total_raised: Number(summary.total_raised)
            },
            data: events
        });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/events  -  create                                                */
/* -------------------------------------------------------------------------- */
async function createEvent(req, res, next) {
    try {
        const body = req.body || {};

        // ---- 1. validation --------------------------------------------------
        const check = v.collect([
            { field: 'event_name',       result: v.requiredText(body.event_name, 'Event name', 3, 150) },
            { field: 'summary',          result: v.requiredText(body.summary, 'Short summary', 10, 255) },
            { field: 'full_description', result: v.requiredText(body.full_description, 'Full description', 20, 8000) },
            { field: 'event_date',       result: v.dateTime(body.event_date, 'Event date') },
            { field: 'venue',            result: v.requiredText(body.venue, 'Venue', 2, 150) },
            { field: 'address',          result: v.requiredText(body.address, 'Address', 2, 200) },
            { field: 'suburb',           result: v.requiredText(body.suburb, 'Suburb', 1, 80) },
            { field: 'city',             result: v.requiredText(body.city, 'City', 1, 80) },
            { field: 'ticket_price',     result: v.money(body.ticket_price, 'Ticket price') },
            { field: 'goal_amount',      result: v.money(body.goal_amount, 'Fundraising goal') },
            { field: 'capacity',         result: v.integerInRange(body.capacity, 'Capacity', 1, 200000) },
            { field: 'category_id',      result: v.isPositiveInt(body.category_id)
                ? { valid: true } : { valid: false, message: 'Please choose a category.' } },
            { field: 'organisation_id',  result: v.isPositiveInt(body.organisation_id)
                ? { valid: true } : { valid: false, message: 'Please choose an organisation.' } },
            { field: 'status',           result: v.oneOf(body.status || 'active', 'Status', ['active', 'suspended']) },
            { field: 'suspension_reason',result: v.optionalText(body.suspension_reason, 'Suspension reason', 255) },
            { field: 'latitude',         result: v.coordinate(body.latitude, 'Latitude', 90) },
            { field: 'longitude',        result: v.coordinate(body.longitude, 'Longitude', 180) },
            { field: 'image_url',        result: v.optionalText(body.image_url, 'Image path', 255) },
            { field: 'end_date',         result: body.end_date
                ? v.dateTime(body.end_date, 'End date') : { valid: true, value: null } }
        ]);

        if (!check.ok) {
            return res.status(422).json({
                success: false,
                error: { message: 'Please fix the highlighted fields and try again.', fields: check.errors }
            });
        }

        // ---- 2. the foreign keys must point at real rows --------------------
        const [category, organisation] = await Promise.all([
            db.queryOne('SELECT category_id FROM event_categories WHERE category_id = ?', [Number(body.category_id)]),
            db.queryOne('SELECT organisation_id FROM charity_organisations WHERE organisation_id = ?', [Number(body.organisation_id)])
        ]);

        if (!category) {
            return res.status(422).json({
                success: false, error: { message: 'Please fix the highlighted fields and try again.',
                    fields: { category_id: 'That category does not exist.' } }
            });
        }
        if (!organisation) {
            return res.status(422).json({
                success: false, error: { message: 'Please fix the highlighted fields and try again.',
                    fields: { organisation_id: 'That organisation does not exist.' } }
            });
        }

        // ---- 3. end date must come after the start date ---------------------
        if (body.end_date && new Date(v.dateTime(body.end_date, 'End date').value) < new Date(v.dateTime(body.event_date, 'Event date').value)) {
            return res.status(422).json({
                success: false, error: { message: 'Please fix the highlighted fields and try again.',
                    fields: { end_date: 'The end date must be after the start date.' } }
            });
        }

        const slug = await makeUniqueSlug(v.requiredText(body.event_name, 'Event name', 3, 150).value);

        // ---- 4. insert ------------------------------------------------------
        const result = await db.query(
            `INSERT INTO events
                (organisation_id, category_id, event_name, slug, summary, full_description,
                 event_date, end_date, venue, address, suburb, city, ticket_price, is_free,
                 goal_amount, capacity, image_url, status, suspension_reason, latitude, longitude)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(body.organisation_id),
                Number(body.category_id),
                v.requiredText(body.event_name, 'Event name', 3, 150).value,
                slug,
                v.requiredText(body.summary, 'Short summary', 10, 255).value,
                v.requiredText(body.full_description, 'Full description', 20, 8000).value,
                v.dateTime(body.event_date, 'Event date').value,
                body.end_date ? v.dateTime(body.end_date, 'End date').value : null,
                v.requiredText(body.venue, 'Venue', 2, 150).value,
                v.requiredText(body.address, 'Address', 2, 200).value,
                v.requiredText(body.suburb, 'Suburb', 1, 80).value,
                v.requiredText(body.city, 'City', 1, 80).value,
                v.money(body.ticket_price, 'Ticket price').value,
                Number(body.is_free) === 1 || String(body.is_free) === 'true' ? 1 : 0,
                v.money(body.goal_amount, 'Fundraising goal').value,
                v.integerInRange(body.capacity, 'Capacity', 1, 200000).value,
                v.optionalText(body.image_url, 'Image path', 255).value,
                v.oneOf(body.status || 'active', 'Status', ['active', 'suspended']).value,
                v.optionalText(body.suspension_reason, 'Suspension reason', 255).value,
                v.coordinate(body.latitude, 'Latitude', 90).value,
                v.coordinate(body.longitude, 'Longitude', 180).value
            ]
        );

        const created = await db.queryOne(
            `SELECT ${ADMIN_COLUMNS} FROM vw_event_list WHERE event_id = ?`,
            [result.insertId]
        );

        res.status(201)
            .location(`/api/events/${result.insertId}`)
            .json({
                success: true,
                message: `Event "${created.event_name}" created.`,
                data: created
            });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  PUT /api/events/:id  -  update                                             */
/* -------------------------------------------------------------------------- */
async function updateEvent(req, res, next) {
    try {
        const { id } = req.params;
        if (!v.isPositiveInt(id)) {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid event id. It must be a positive whole number.' }
            });
        }

        const existing = await db.queryOne(
            'SELECT event_id, event_name FROM events WHERE event_id = ?',
            [Number(id)]
        );
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: { message: `No charity event found with id ${id}.` }
            });
        }

        const body = req.body || {};

        // ---- validation (same rules as create) ------------------------------
        const check = v.collect([
            { field: 'event_name',       result: v.requiredText(body.event_name, 'Event name', 3, 150) },
            { field: 'summary',          result: v.requiredText(body.summary, 'Short summary', 10, 255) },
            { field: 'full_description', result: v.requiredText(body.full_description, 'Full description', 20, 8000) },
            { field: 'event_date',       result: v.dateTime(body.event_date, 'Event date') },
            { field: 'venue',            result: v.requiredText(body.venue, 'Venue', 2, 150) },
            { field: 'address',          result: v.requiredText(body.address, 'Address', 2, 200) },
            { field: 'suburb',           result: v.requiredText(body.suburb, 'Suburb', 1, 80) },
            { field: 'city',             result: v.requiredText(body.city, 'City', 1, 80) },
            { field: 'ticket_price',     result: v.money(body.ticket_price, 'Ticket price') },
            { field: 'goal_amount',      result: v.money(body.goal_amount, 'Fundraising goal') },
            { field: 'capacity',         result: v.integerInRange(body.capacity, 'Capacity', 1, 200000) },
            { field: 'category_id',      result: v.isPositiveInt(body.category_id)
                ? { valid: true } : { valid: false, message: 'Please choose a category.' } },
            { field: 'organisation_id',  result: v.isPositiveInt(body.organisation_id)
                ? { valid: true } : { valid: false, message: 'Please choose an organisation.' } },
            { field: 'status',           result: v.oneOf(body.status || 'active', 'Status', ['active', 'suspended']) },
            { field: 'suspension_reason',result: v.optionalText(body.suspension_reason, 'Suspension reason', 255) },
            { field: 'latitude',         result: v.coordinate(body.latitude, 'Latitude', 90) },
            { field: 'longitude',        result: v.coordinate(body.longitude, 'Longitude', 180) },
            { field: 'image_url',        result: v.optionalText(body.image_url, 'Image path', 255) },
            { field: 'end_date',         result: body.end_date
                ? v.dateTime(body.end_date, 'End date') : { valid: true, value: null } }
        ]);

        if (!check.ok) {
            return res.status(422).json({
                success: false,
                error: { message: 'Please fix the highlighted fields and try again.', fields: check.errors }
            });
        }

        const [category, organisation] = await Promise.all([
            db.queryOne('SELECT category_id FROM event_categories WHERE category_id = ?', [Number(body.category_id)]),
            db.queryOne('SELECT organisation_id FROM charity_organisations WHERE organisation_id = ?', [Number(body.organisation_id)])
        ]);

        if (!category || !organisation) {
            const fields = {};
            if (!category) fields.category_id = 'That category does not exist.';
            if (!organisation) fields.organisation_id = 'That organisation does not exist.';
            return res.status(422).json({
                success: false,
                error: { message: 'Please fix the highlighted fields and try again.', fields }
            });
        }

        if (body.end_date && new Date(v.dateTime(body.end_date, 'End date').value) < new Date(v.dateTime(body.event_date, 'Event date').value)) {
            return res.status(422).json({
                success: false, error: { message: 'Please fix the highlighted fields and try again.',
                    fields: { end_date: 'The end date must be after the start date.' } }
            });
        }

        // Keep the existing slug unless the name actually changed, so external
        // links to the event keep working.
        const newName = v.requiredText(body.event_name, 'Event name', 3, 150).value;
        const slug = newName === existing.event_name
            ? (await db.queryOne('SELECT slug FROM events WHERE event_id = ?', [Number(id)])).slug
            : await makeUniqueSlug(newName, Number(id));

        // ---- update ---------------------------------------------------------
        await db.query(
            `UPDATE events SET
                organisation_id = ?, category_id = ?, event_name = ?, slug = ?,
                summary = ?, full_description = ?, event_date = ?, end_date = ?,
                venue = ?, address = ?, suburb = ?, city = ?, ticket_price = ?,
                is_free = ?, goal_amount = ?, capacity = ?, image_url = ?,
                status = ?, suspension_reason = ?, latitude = ?, longitude = ?
             WHERE event_id = ?`,
            [
                Number(body.organisation_id),
                Number(body.category_id),
                newName,
                slug,
                v.requiredText(body.summary, 'Short summary', 10, 255).value,
                v.requiredText(body.full_description, 'Full description', 20, 8000).value,
                v.dateTime(body.event_date, 'Event date').value,
                body.end_date ? v.dateTime(body.end_date, 'End date').value : null,
                v.requiredText(body.venue, 'Venue', 2, 150).value,
                v.requiredText(body.address, 'Address', 2, 200).value,
                v.requiredText(body.suburb, 'Suburb', 1, 80).value,
                v.requiredText(body.city, 'City', 1, 80).value,
                v.money(body.ticket_price, 'Ticket price').value,
                Number(body.is_free) === 1 || String(body.is_free) === 'true' ? 1 : 0,
                v.money(body.goal_amount, 'Fundraising goal').value,
                v.integerInRange(body.capacity, 'Capacity', 1, 200000).value,
                v.optionalText(body.image_url, 'Image path', 255).value,
                v.oneOf(body.status || 'active', 'Status', ['active', 'suspended']).value,
                v.optionalText(body.suspension_reason, 'Suspension reason', 255).value,
                v.coordinate(body.latitude, 'Latitude', 90).value,
                v.coordinate(body.longitude, 'Longitude', 180).value,
                Number(id)
            ]
        );

        const updated = await db.queryOne(
            `SELECT ${ADMIN_COLUMNS} FROM vw_event_list WHERE event_id = ?`,
            [Number(id)]
        );

        res.status(200).json({
            success: true,
            message: `Event "${updated.event_name}" updated.`,
            data: updated
        });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/events/:id  -  remove, but ONLY when nothing is booked         */
/* -------------------------------------------------------------------------- */
async function deleteEvent(req, res, next) {
    try {
        const { id } = req.params;
        if (!v.isPositiveInt(id)) {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid event id. It must be a positive whole number.' }
            });
        }

        const event = await db.queryOne(
            `SELECT e.event_id, e.event_name,
                    COUNT(r.registration_id) AS registration_count
             FROM events e
             LEFT JOIN event_registrations r ON r.event_id = e.event_id
             WHERE e.event_id = ?
             GROUP BY e.event_id, e.event_name`,
            [Number(id)]
        );

        if (!event) {
            return res.status(404).json({
                success: false,
                error: { message: `No charity event found with id ${id}.` }
            });
        }

        // ---- THE DATA-INTEGRITY RULE ---------------------------------------
        // "the event can only be deleted if it has not yet received any
        //  registrations. If registrations exist, the deletion attempt should
        //  be blocked, and an appropriate error response should be returned."
        if (Number(event.registration_count) > 0) {
            return res.status(409).json({
                success: false,
                error: {
                    message: `"${event.event_name}" cannot be deleted because ${event.registration_count}
                              registration(s) are already recorded against it.`
                              .replace(/\s+/g, ' ').trim(),
                    code: 'EVENT_HAS_REGISTRATIONS',
                    registration_count: Number(event.registration_count)
                }
            });
        }

        // donations and event_updates cascade (ON DELETE CASCADE), so removing
        // the event cleans up its children automatically.
        await db.query('DELETE FROM events WHERE event_id = ?', [Number(id)]);

        res.status(200).json({
            success: true,
            message: `Event "${event.event_name}" was deleted.`
        });
    } catch (error) {
        // Last line of defence: the FK is ON DELETE RESTRICT, so if a booking
        // somehow appeared between the check and the delete, MySQL refuses.
        if (error && error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                error: {
                    message: 'This event cannot be deleted because registrations are recorded against it.',
                    code: 'EVENT_HAS_REGISTRATIONS'
                }
            });
        }
        next(error);
    }
}

module.exports = {
    listAllEvents,
    createEvent,
    updateEvent,
    deleteEvent
};
