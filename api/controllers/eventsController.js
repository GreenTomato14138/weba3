/**
 * eventsController.js - handlers for the public /api/events* read endpoints
 * (list, search, and detail with the event's registrations).
 */

'use strict';

const db = require('../event_db');

/** Columns returned to the browser for a card / list item. */
const LIST_COLUMNS = `
    event_id, event_name, slug, summary, event_date, end_date, venue, address,
    suburb, city, ticket_price, is_free, goal_amount, capacity, image_url,
    status, category_id, category_name, category_slug, category_icon, category_colour,
    organisation_id, organisation_name, organisation_colour, organisation_email,
    raised_amount, supporter_count, progress_pct, days_remaining, event_status,
    registration_count, tickets_taken, capacity_pct, latitude, longitude
`;

/** Columns returned for the full event details page. */
const DETAIL_COLUMNS = LIST_COLUMNS + `,
    full_description, organisation_mission, organisation_phone, organisation_website,
    suspension_reason, created_at, updated_at
`;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Anything that is not a positive integer cannot be a primary key.
 * Rejecting it here keeps invalid input out of the SQL layer entirely.
 */
function isValidId(value) {
    return /^[1-9][0-9]{0,9}$/.test(String(value));
}

/** Accepts 2026-10-11 (and any full datetime) - rejects everything else. */
function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime());
}

/**
 * The public website must never see a suspended event, so every read query
 * carries the same guard. Keeping it in one constant guarantees the rule
 * cannot be forgotten on a new endpoint.
 */
const PUBLISHABLE = `status = 'active'`;

/* -------------------------------------------------------------------------- */
/*  GET /api/events                                                            */
/*  Home page feed. ?scope=upcoming (default) | past | all                     */
/* -------------------------------------------------------------------------- */
async function listEvents(req, res, next) {
    try {
        const scope = (req.query.scope || 'upcoming').toLowerCase();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 50);
        const sort = (req.query.sort || 'date').toLowerCase();

        const conditions = [PUBLISHABLE];
        const params = [];

        if (scope === 'upcoming') {
            conditions.push(`event_date >= CURDATE()`);
        } else if (scope === 'past') {
            conditions.push(`event_date < CURDATE()`);
        } else if (scope !== 'all') {
            return res.status(400).json({
                success: false,
                error: { message: "Invalid 'scope'. Use one of: upcoming, past, all." }
            });
        }

        const orderBy = {
            date: 'event_date ASC',
            'date-desc': 'event_date DESC',
            progress: 'progress_pct DESC',
            raised: 'raised_amount DESC',
            name: 'event_name ASC'
        }[sort];

        if (!orderBy) {
            return res.status(400).json({
                success: false,
                error: { message: "Invalid 'sort'. Use one of: date, date-desc, progress, raised, name." }
            });
        }

        const sql = `
            SELECT ${LIST_COLUMNS}
            FROM vw_event_list
            WHERE ${conditions.join(' AND ')}
            ORDER BY ${orderBy}
            LIMIT ?`;
        params.push(limit);

        const events = await db.query(sql, params);

        res.status(200).json({
            success: true,
            scope,
            count: events.length,
            data: events
        });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/events/featured                                                   */
/*  The three most imminent upcoming events, used by the home page carousel.   */
/* -------------------------------------------------------------------------- */
async function listFeatured(req, res, next) {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 6);
        const sql = `
            SELECT ${LIST_COLUMNS}
            FROM vw_event_list
            WHERE ${PUBLISHABLE} AND event_date >= CURDATE()
            ORDER BY event_date ASC
            LIMIT ?`;
        const events = await db.query(sql, [limit]);

        res.status(200).json({ success: true, count: events.length, data: events });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/events/search?...                                                 */
/*  Search page. Every filter is optional and filters combine (AND).           */
/* -------------------------------------------------------------------------- */
async function searchEvents(req, res, next) {
    try {
        const { q, category, location, from, to, free, sort } = req.query;

        const conditions = [PUBLISHABLE, `event_date >= CURDATE()`]; // search only returns active/upcoming events
        const params = [];

        // --- keyword: matches the event name, summary, venue or suburb -------
        if (q && String(q).trim() !== '') {
            conditions.push(`(event_name LIKE ? OR summary LIKE ? OR venue LIKE ? OR suburb LIKE ?)`);
            const like = `%${String(q).trim()}%`;
            params.push(like, like, like, like);
        }

        // --- category: one value or many (checkbox multi-select) -------------
        //     /api/events/search?category=fun-run&category=walk
        //     /api/events/search?category=1&category=5
        //     Each value may be the numeric id or the slug.
        const categoryValues = (Array.isArray(category) ? category : (category ? [category] : []))
            .map((v) => String(v).trim())
            .filter(Boolean);

        if (categoryValues.length) {
            const orParts = [];
            categoryValues.forEach((value) => {
                if (/^\d+$/.test(value)) {
                    orParts.push(`category_id = ?`);
                    params.push(Number(value));
                } else {
                    orParts.push(`category_slug = ?`);
                    params.push(value);
                }
            });
            conditions.push(`(${orParts.join(' OR ')})`);
        }

        // --- location: free text against suburb, venue, address and city -----
        if (location && String(location).trim() !== '') {
            conditions.push(`(suburb LIKE ? OR venue LIKE ? OR address LIKE ? OR city LIKE ?)`);
            const like = `%${String(location).trim()}%`;
            params.push(like, like, like, like);
        }

        // --- date window ------------------------------------------------------
        if (from && String(from).trim() !== '') {
            if (!isValidDate(from)) {
                return res.status(400).json({
                    success: false,
                    error: { message: "Invalid 'from' date. Expected format YYYY-MM-DD." }
                });
            }
            conditions.push(`DATE(event_date) >= ?`);
            params.push(String(from));
        }
        if (to && String(to).trim() !== '') {
            if (!isValidDate(to)) {
                return res.status(400).json({
                    success: false,
                    error: { message: "Invalid 'to' date. Expected format YYYY-MM-DD." }
                });
            }
            conditions.push(`DATE(event_date) <= ?`);
            params.push(String(to));
        }

        if (String(free).toLowerCase() === 'true') {
            conditions.push(`is_free = 1`);
        }

        const orderBy = {
            'date': 'event_date ASC',
            'date-desc': 'event_date DESC',
            'progress': 'progress_pct DESC',
            'raised': 'raised_amount DESC',
            'name': 'event_name ASC',
            'price': 'ticket_price ASC'
        }[String(sort || 'date').toLowerCase()] || 'event_date ASC';

        const sql = `
            SELECT ${LIST_COLUMNS}
            FROM vw_event_list
            WHERE ${conditions.join(' AND ')}
            ORDER BY ${orderBy}`;

        const events = await db.query(sql, params);

        // A friendly 200 + empty array is better UX than a 404: "no match" is a
        // valid answer, not an error. The client renders the empty-state card.
        res.status(200).json({
            success: true,
            count: events.length,
            filters: { q: q || null, category: category || null, location: location || null, from: from || null, to: to || null },
            data: events
        });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/events/:id                                                        *
 *  *** IMPROVED IN ASSESSMENT 3 (Part 2 - "Improved event details") ***       *
 *  "Update one of your existing endpoints for a single event (by ID) so that  *
 *  it efficiently retrieves not only the event details but also the complete  *
 *  list of associated registrations for that specific event."                 *
 *                                                                             *
 *  The registrations are ordered by registration_date DESC, which is exactly  *
 *  the order Part 3 demands on the page: "sorted by the latest date when the  *
 *  tickets were purchased".                                                    */
/* -------------------------------------------------------------------------- */
async function getEventById(req, res, next) {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                error: { message: 'Invalid event id. It must be a positive whole number.' }
            });
        }

        const sql = `SELECT ${DETAIL_COLUMNS} FROM vw_event_list WHERE event_id = ?`;
        const event = await db.queryOne(sql, [Number(id)]);

        if (!event || event.status !== 'active') {
            return res.status(404).json({
                success: false,
                error: { message: `No active charity event found with id ${id}.` }
            });
        }

        // Latest donations, organiser updates and the full registration list are
        // loaded together with the event so the details page needs ONE round
        // trip. Promise.all runs the three queries concurrently rather than
        // waiting for each in turn - that is what "efficiently retrieves" means.
        const [donations, updates, registrations] = await Promise.all([
            db.query(
                `SELECT donor_name, amount, message, donated_at
                 FROM donations WHERE event_id = ?
                 ORDER BY donated_at DESC LIMIT 6`,
                [Number(id)]
            ),
            db.query(
                `SELECT update_id, title, body, posted_at
                 FROM event_updates WHERE event_id = ?
                 ORDER BY posted_at DESC`,
                [Number(id)]
            ),
            db.query(
                `SELECT registration_id, event_id, full_name, email, phone,
                        tickets, registration_date, notes
                 FROM event_registrations WHERE event_id = ?
                 ORDER BY registration_date DESC, registration_id DESC`,
                [Number(id)]
            )
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...event,
                recent_donations: donations,
                updates,
                registrations,                       // NEW in Assessment 3
                registration_count: registrations.length,
                tickets_taken: registrations.reduce((sum, r) => sum + Number(r.tickets), 0)
            }
        });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/donations/recent                                                  */
/*  Latest pledges across every published event - drives the home page ticker. */
/* -------------------------------------------------------------------------- */
async function listRecentDonations(req, res, next) {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
        const sql = `
            SELECT d.donor_name, d.amount, d.message, d.donated_at, e.event_id, e.event_name
            FROM donations d
            INNER JOIN events e ON e.event_id = d.event_id
            WHERE e.status = 'active'
            ORDER BY d.donated_at DESC
            LIMIT ?`;
        const donations = await db.query(sql, [limit]);
        res.status(200).json({ success: true, count: donations.length, data: donations });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/categories                                                        */
/* -------------------------------------------------------------------------- */
async function listCategories(req, res, next) {
    try {
        const sql = `
            SELECT c.category_id, c.category_name, c.slug, c.description, c.icon, c.colour_hex,
                   COUNT(e.event_id) AS event_count
            FROM event_categories c
            LEFT JOIN events e
                   ON e.category_id = c.category_id
                  AND e.status = 'active'
                  AND e.event_date >= CURDATE()
            GROUP BY c.category_id, c.category_name, c.slug, c.description, c.icon, c.colour_hex
            ORDER BY c.category_name ASC`;
        const categories = await db.query(sql);
        res.status(200).json({ success: true, count: categories.length, data: categories });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/organisations                                                     */
/* -------------------------------------------------------------------------- */
async function listOrganisations(req, res, next) {
    try {
        const sql = `
            SELECT o.organisation_id, o.organisation_name, o.mission, o.contact_email,
                   o.phone, o.website, o.city, o.established_year, o.logo_colour,
                   COUNT(e.event_id) AS event_count
            FROM charity_organisations o
            LEFT JOIN events e ON e.organisation_id = o.organisation_id AND e.status = 'active'
            GROUP BY o.organisation_id, o.organisation_name, o.mission, o.contact_email,
                     o.phone, o.website, o.city, o.established_year, o.logo_colour
            ORDER BY o.organisation_name ASC`;
        const organisations = await db.query(sql);
        res.status(200).json({ success: true, count: organisations.length, data: organisations });
    } catch (error) {
        next(error);
    }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/stats  -  headline numbers for the home page counter animation    */
/* -------------------------------------------------------------------------- */
async function getStats(req, res, next) {
    try {
        const totals = await db.queryOne(`
            SELECT
                COUNT(*)                                        AS total_events,
                SUM(CASE WHEN event_date >= CURDATE() THEN 1 ELSE 0 END) AS upcoming_events,
                SUM(CASE WHEN event_date <  CURDATE() THEN 1 ELSE 0 END) AS past_events,
                COALESCE(SUM(raised_amount), 0)                  AS total_raised,
                COALESCE(SUM(supporter_count), 0)                AS total_supporters,
                COALESCE(SUM(capacity), 0)                       AS total_capacity
            FROM vw_event_list
            WHERE ${PUBLISHABLE}`);

        const categoryCount = await db.queryOne(`SELECT COUNT(*) AS c FROM event_categories`);
        const orgCount = await db.queryOne(`SELECT COUNT(*) AS c FROM charity_organisations`);

        res.status(200).json({
            success: true,
            data: {
                total_events: Number(totals.total_events),
                upcoming_events: Number(totals.upcoming_events),
                past_events: Number(totals.past_events),
                total_raised: Number(totals.total_raised),
                total_supporters: Number(totals.total_supporters),
                total_capacity: Number(totals.total_capacity),
                total_categories: Number(categoryCount.c),
                total_organisations: Number(orgCount.c),
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listEvents,
    listFeatured,
    searchEvents,
    getEventById,
    listCategories,
    listOrganisations,
    listRecentDonations,
    getStats
};
