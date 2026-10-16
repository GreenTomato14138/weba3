-- =====================================================================================
-- PROG2002 - Web Development II
-- Assessment 3 : Complete Dynamic Website - Charity Events (Guangxi, China)
--
-- Student name : Boyuan Liu
-- Student ID   : 24832410
-- File         : charityevents_a3_db.sql   (MySQL 8.x / 9.x, utf8mb4)
--
-- -------------------------------------------------------------------------------------
-- WHAT THIS FILE DOES
--   Creates the complete Assessment 3 database "charityevents_a3_db": six tables,
--   one reporting view and the full sample data set (8 categories, 6 organisations,
--   22 events, the donation ledger, the organiser updates and 17 event
--   registrations). It can be imported on a clean machine or re-imported over an
--   existing copy of itself.
--
--   This is the Assessment 2 schema PLUS the Assessment 3 changes:
--     * events.latitude / events.longitude  - needed by the optional Open-Meteo
--       weather API (Part 6) so the event page can show a live forecast.
--     * event_registrations                 - NEW table (Part 1). Records who
--       registered for which event, when, and how many tickets they bought.
--
-- HOW TO RUN
--   MySQL Workbench : File > Open Script ... > click the lightning bolt
--   Command line    : mysql -u root -p < charityevents_a3_db.sql
--
-- TABLES
--   charity_organisations  the charities that host the events
--   event_categories       Fun Run, Gala Dinner, Silent Auction, Benefit Concert,
--                          Community Walk, Food Festival, Volunteer Day, Charity Market
--   events                 one row per charity event; status = 'active' | 'suspended'
--   donations              donation ledger, aggregated for Goal vs Progress
--   event_updates          organiser news rendered on the details page
--   event_registrations    NEW in A3 - who booked tickets for which event
--
--   charity_organisations 1 --- * events * --- 1 event_categories
--   events 1 --- * donations          events 1 --- * event_updates
--   events 1 --- * event_registrations
--
-- SAMPLE DATA
--   22 events across Guangxi - Nanning, Guilin, Liuzhou, Beihai, Wuzhou, Yulin, Baise,
--   Fangchenggang and Longsheng. Two are already past, one is suspended for a policy
--   breach and is never returned by the public API. 17 registrations are seeded
--   across 8 different events (the brief requires a minimum of 10).
-- =====================================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS charityevents_a3_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE charityevents_a3_db;

-- Re-importable: clear the previous objects first (children before parents).
SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS vw_event_list;
DROP TABLE IF EXISTS event_registrations;
DROP TABLE IF EXISTS event_updates;
DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS event_categories;
DROP TABLE IF EXISTS charity_organisations;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
--  TABLE DEFINITIONS
-- =====================================================================================

-- =====================================================================================
-- 1. charity_organisations
--    The charitable organisations that host the fundraising events.
--    One organisation  ->  many events   (1 : N)
-- =====================================================================================
CREATE TABLE charity_organisations (
    organisation_id   INT            NOT NULL AUTO_INCREMENT,
    organisation_name VARCHAR(120)   NOT NULL,
    mission           VARCHAR(255)   NOT NULL,
    about             TEXT           NULL,
    contact_email     VARCHAR(120)   NOT NULL,
    phone             VARCHAR(40)    NULL,
    website           VARCHAR(180)   NULL,
    city              VARCHAR(80)    NOT NULL DEFAULT 'Nanning',
    established_year  YEAR           NULL,
    logo_colour       VARCHAR(9)     NOT NULL DEFAULT '#6366F1',
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organisation_id),
    UNIQUE KEY uq_org_name (organisation_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =====================================================================================
-- 2. event_categories
--    Lookup table for the type of fundraising activity (fun run, gala dinner,
--    silent auction, concert, community walk, food festival, volunteer day,
--    charity market).  One category  ->  many events   (1 : N)
-- =====================================================================================
CREATE TABLE event_categories (
    category_id   INT          NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(80)  NOT NULL,
    slug          VARCHAR(80)  NOT NULL,
    description   VARCHAR(255) NULL,
    icon          VARCHAR(16)  NOT NULL DEFAULT '★',
    colour_hex    VARCHAR(9)   NOT NULL DEFAULT '#6366F1',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_category_name (category_name),
    UNIQUE KEY uq_category_slug (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =====================================================================================
-- 3. events
--    The core entity: naming, description, schedule, venue, ticketing and the
--    fundraising goal. `status` lets an organiser SUSPEND an event that breaches
--    policy - suspended events are never served to the public.
-- =====================================================================================
CREATE TABLE events (
    event_id          INT            NOT NULL AUTO_INCREMENT,
    organisation_id   INT            NOT NULL,
    category_id       INT            NOT NULL,
    event_name        VARCHAR(150)   NOT NULL,
    slug              VARCHAR(160)   NOT NULL,
    summary           VARCHAR(255)   NOT NULL,
    full_description  TEXT           NOT NULL,
    event_date        DATETIME       NOT NULL,
    end_date          DATETIME       NULL,
    venue             VARCHAR(150)   NOT NULL,
    address           VARCHAR(200)   NOT NULL,
    suburb            VARCHAR(80)    NOT NULL,
    city              VARCHAR(80)    NOT NULL DEFAULT 'Nanning',
    ticket_price      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    is_free           TINYINT(1)     NOT NULL DEFAULT 0,
    goal_amount       DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    capacity          INT            NOT NULL DEFAULT 0,
    image_url         VARCHAR(255)   NULL,
    -- NEW in Assessment 3: the Open-Meteo weather API (Part 6, optional) needs the
    -- geographic coordinates of the venue to return a forecast for the event day.
    latitude          DECIMAL(9,6)   NULL,
    longitude         DECIMAL(9,6)   NULL,
    status            ENUM('active','suspended') NOT NULL DEFAULT 'active',
    suspension_reason VARCHAR(255)   NULL,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    UNIQUE KEY uq_event_slug (slug),
    KEY idx_event_date (event_date),
    KEY idx_category (category_id),
    KEY idx_organisation (organisation_id),
    KEY idx_status_date (status, event_date),
    CONSTRAINT fk_events_organisation
        FOREIGN KEY (organisation_id) REFERENCES charity_organisations (organisation_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_events_category
        FOREIGN KEY (category_id) REFERENCES event_categories (category_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_ticket_price CHECK (ticket_price >= 0),
    CONSTRAINT chk_goal_amount  CHECK (goal_amount  >= 0),
    CONSTRAINT chk_latitude  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    CONSTRAINT chk_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =====================================================================================
-- 4. donations
--    Every pledge / ticket donation made toward an event. "Raised" is never stored
--    on `events` - it is aggregated from here, so Goal vs Progress can never drift.
-- =====================================================================================
CREATE TABLE donations (
    donation_id   INT           NOT NULL AUTO_INCREMENT,
    event_id      INT           NOT NULL,
    donor_name    VARCHAR(120)  NOT NULL,
    amount        DECIMAL(10,2) NOT NULL,
    message       VARCHAR(255)  NULL,
    donated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (donation_id),
    KEY idx_donation_event (event_id),
    CONSTRAINT fk_donations_event
        FOREIGN KEY (event_id) REFERENCES events (event_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_donation_amount CHECK (amount > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =====================================================================================
-- 5. event_updates
--    Short news items posted by the organiser and rendered as the "Latest updates"
--    timeline on the event details page.
-- =====================================================================================
CREATE TABLE event_updates (
    update_id INT          NOT NULL AUTO_INCREMENT,
    event_id  INT          NOT NULL,
    title     VARCHAR(150) NOT NULL,
    body      VARCHAR(500) NOT NULL,
    posted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (update_id),
    KEY idx_update_event (event_id),
    CONSTRAINT fk_updates_event
        FOREIGN KEY (event_id) REFERENCES events (event_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =====================================================================================
-- 6. event_registrations   *** NEW IN ASSESSMENT 3 (Part 1) ***
--    Records a web user booking tickets for one charity event.
--
--    BUSINESS RULES
--      * "One user may register for multiple events"  ->  nothing stops the same
--        email appearing on several rows, as long as each row is a different event.
--      * "can only register for an event once"        ->  enforced by the composite
--        UNIQUE KEY uq_reg_event_email (event_id, email). A second attempt to book
--        the same event with the same email is rejected by MySQL (ER_DUP_ENTRY),
--        which the API turns into a friendly 409 Conflict response.
--
--    RELATIONSHIP
--      events 1 --- * event_registrations
--      ON DELETE RESTRICT is deliberate: an event that already has registrations
--      must NOT be deletable (Part 2 data-integrity rule). The API also checks
--      explicitly so it can return a helpful message instead of a raw DB error.
-- =====================================================================================
CREATE TABLE event_registrations (
    registration_id   INT            NOT NULL AUTO_INCREMENT,
    event_id          INT            NOT NULL,
    full_name         VARCHAR(120)   NOT NULL,
    email             VARCHAR(160)   NOT NULL,
    phone             VARCHAR(40)    NOT NULL,
    tickets           INT            NOT NULL DEFAULT 1,
    registration_date DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes             VARCHAR(255)   NULL,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (registration_id),
    -- The "one registration per person per event" rule.
    UNIQUE KEY uq_reg_event_email (event_id, email),
    -- Speeds up the two reads the website performs most often:
    -- "registrations for this event" and "most recent registrations".
    KEY idx_reg_event (event_id),
    KEY idx_reg_date (registration_date),
    CONSTRAINT fk_reg_event
        FOREIGN KEY (event_id) REFERENCES events (event_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_tickets CHECK (tickets > 0 AND tickets <= 50)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =====================================================================================
-- 7. vw_event_list  (reporting view)
--    Denormalised read model consumed by the API: resolves every join, aggregates
--    the donations AND the registrations, and derives the business status of an event
--        'suspended' -> withdrawn by the organisation (never published)
--        'past'      -> event_date is before today
--        'upcoming'  -> event_date is today or later
--
--    NEW IN A3: latitude/longitude (weather API), registration_count and
--    tickets_taken. tickets_taken is what the admin list shows as "booked".
-- =====================================================================================
CREATE OR REPLACE VIEW vw_event_list AS
SELECT
    e.event_id, e.event_name, e.slug, e.summary, e.full_description, e.event_date,
    e.end_date, e.venue, e.address, e.suburb, e.city, e.ticket_price, e.is_free,
    e.goal_amount, e.capacity, e.image_url, e.status, e.suspension_reason,
    e.latitude, e.longitude,
    e.created_at, e.updated_at,
    c.category_id, c.category_name, c.slug AS category_slug, c.icon AS category_icon,
    c.colour_hex AS category_colour,
    o.organisation_id, o.organisation_name, o.mission AS organisation_mission,
    o.contact_email AS organisation_email, o.phone AS organisation_phone,
    o.website AS organisation_website, o.logo_colour AS organisation_colour,
    COALESCE(d.raised_amount, 0)   AS raised_amount,
    COALESCE(d.supporter_count, 0) AS supporter_count,
    ROUND(COALESCE(d.raised_amount, 0) / NULLIF(e.goal_amount, 0) * 100, 1) AS progress_pct,
    -- Registration roll-up (A3)
    COALESCE(r.registration_count, 0) AS registration_count,
    COALESCE(r.tickets_taken, 0)      AS tickets_taken,
    ROUND(COALESCE(r.tickets_taken, 0) / NULLIF(e.capacity, 0) * 100, 1) AS capacity_pct,
    DATEDIFF(DATE(e.event_date), CURDATE()) AS days_remaining,
    CASE
        WHEN e.status = 'suspended'   THEN 'suspended'
        WHEN e.event_date < CURDATE() THEN 'past'
        ELSE 'upcoming'
    END AS event_status
FROM events e
INNER JOIN event_categories      c ON c.category_id     = e.category_id
INNER JOIN charity_organisations o ON o.organisation_id = e.organisation_id
LEFT JOIN (
    SELECT event_id, SUM(amount) AS raised_amount, COUNT(*) AS supporter_count
    FROM donations GROUP BY event_id
) d ON d.event_id = e.event_id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS registration_count, SUM(tickets) AS tickets_taken
    FROM event_registrations GROUP BY event_id
) r ON r.event_id = e.event_id;

-- =====================================================================================
--  SEED DATA
-- =====================================================================================

-- ------------------------------------------------------------------ organisations --
INSERT INTO charity_organisations
    (organisation_name, mission, about, contact_email, phone, website, city, established_year, logo_colour)
VALUES
 ('Lijiang River Eco Guardians',
  'Protecting the Lijiang River, its wetlands and the karst hills that depend on it.',
  'Founded in Guilin in 2009, the Guardians run weekly river patrols, mangrove and reed-bank replanting, and a floating clean-up fleet of 40 volunteer skiffs. Every event we host funds water-quality testing and pays local river workers to restore eroded banks.',
  'hello@lijiangguardians.org.cn', '+86 773 2820 118', 'https://www.lijiangguardians.org.cn', 'Guilin', 2009, '#0E9488'),

 ('Bagui Children Health Trust',
  'Paediatric surgery, family accommodation and school support for children across Guangxi.',
  'The Trust works with eleven hospitals across the province. Donations pay for surgical missions, cover accommodation so parents can stay near the ward, and fund the school packs that let a child return to class after treatment.',
  'care@baguichildren.org.cn', '+86 771 5566 208', 'https://www.baguichildren.org.cn', 'Nanning', 2012, '#7C3AED'),

 ('Beibu Gulf Marine Protection',
  'Guarding the coastline, mangroves and sea-turtle nesting beaches of the Beibu Gulf.',
  'Our rangers patrol 180 km of coastline between Beihai and Fangchenggang, protect seven turtle nesting beaches and run the region''s only sea-turtle rehabilitation pool. Local fishing families are paid to collect and hand in ghost nets.',
  'ocean@beibugulf.org.cn', '+86 779 3302 447', 'https://www.beibugulf.org.cn', 'Beihai', 2015, '#0EA5E9'),

 ('Yongjiang Community Care',
  'Meals, emergency relief and neighbourhood support for families along the Yongjiang.',
  'A Nanning neighbourhood charity since 2006. We run three community kitchens, a school-uniform bank and a same-week emergency fund for families hit by illness, fire or job loss - all delivered by 900 registered volunteers.',
  'help@yongjiangcare.org.cn', '+86 771 2244 909', 'https://www.yongjiangcare.org.cn', 'Nanning', 2006, '#F0594B'),

 ('Guixi Rural Education Fund',
  'Scholarships, libraries and teacher support for mountain schools in western Guangxi.',
  'We support 46 village schools across Baise, Hechi and Chongzuo: boarding scholarships for children who walk two hours to class, 12,000-library books a year, and a living supplement that keeps young teachers in the mountains.',
  'study@guixiedu.org.cn', '+86 776 8812 330', 'https://www.guixiedu.org.cn', 'Baise', 2011, '#F59E0B'),

 ('Zhuang Heritage Arts Network',
  'Keeping Zhuang brocade, folk song and craft traditions alive - and turning them into livelihoods.',
  'A network of 300 weavers, dyers and singers in 14 counties. We train young artisans, buy their work at fair prices, and channel the proceeds back into apprenticeships so the craft survives another generation.',
  'hello@zhuangheritage.org.cn', '+86 771 6677 512', 'https://www.zhuangheritage.org.cn', 'Nanning', 2018, '#DB2777');

-- -------------------------------------------------------------------- categories --
INSERT INTO event_categories (category_name, slug, description, icon, colour_hex)
VALUES
 ('Fun Run'             , 'fun-run'     , 'Charity runs where every kilometre on the course is sponsored.'          , '🏃', '#FF5F6D'),
 ('Gala Dinner'         , 'gala-dinner' , 'Formal evenings with dining, entertainment and a live appeal.'           , '🥂', '#7C3AED'),
 ('Silent Auction'      , 'auction'     , 'Donated art, craft and experiences bid on quietly through the evening.'  , '🔨', '#F59E0B'),
 ('Benefit Concert'     , 'concert'     , 'Live music where every ticket funds the cause directly.'                 , '🎵', '#06B6D4'),
 ('Community Walk'      , 'walk'        , 'Accessible, family-friendly walks along rivers, lakes and coastline.'    , '🚶', '#10B981'),
 ('Food Festival'       , 'festival'    , 'Street food and produce stalls raising funds plate by plate.'            , '🎪', '#EC4899'),
 ('Volunteer Day'       , 'volunteer'   , 'Hands-on days of service - clean-ups, planting and community repair.'    , '🤝', '#22C55E'),
 ('Charity Market'      , 'market'      , 'Craft and heritage markets where every stall donates its takings.'       , '🧺', '#8B5CF6');

-- ------------------------------------------------------------------------ events --
-- 19 upcoming / 2 past / 1 suspended  (22 sample events in total)
INSERT INTO events
 (organisation_id, category_id, event_name, slug, summary, full_description,
  event_date, end_date, venue, address, suburb, city, ticket_price, is_free,
  goal_amount, capacity, image_url, status, suspension_reason)
VALUES
 -- ---- Nanning ----
 (4, 1, 'Nanning Yongjiang Sunrise Fun Run', 'nanning-yongjiang-sunrise-fun-run',
  'A 5 km and 10 km run along the Yongjiang as the sun comes up over Nanning.',
  'Runners set off from Jiangnan Riverside Greenway at first light, choosing the 5 km community lap or the 10 km challenge. Local drum teams play along the water, and the finish line turns into a breakfast market. Every entry funds a school-uniform pack and a week of hot lunches for a Nanning child whose family is doing it tough. Last year 2,600 runners funded 1,940 packs.',
  '2026-10-11 06:30:00', '2026-10-11 11:00:00',
  'Jiangnan Riverside Greenway', 'No. 8 Jiangnan Avenue', 'Jiangnan', 'Nanning',
  35.00, 0, 150000.00, 3000, 'assets/img/sunrise-fun-run.jpg', 'active', NULL),

 -- ---- Guilin ----
 (1, 1, 'Guilin Two Rivers Four Lakes Run', 'guilin-two-rivers-four-lakes-run',
  'Circle Guilin''s famous waterways on foot - past the Sun and Moon Pagodas at dawn.',
  'A single 12 km loop that links the Li and Taohua rivers with Lakes Shan, Rong, Gui and Mulong. The route is flat, fully marshalled and open to walkers as well as runners. Entry includes a bamboo finishers medal carved by Lijiang artisans, and every yuan raised pays for water-quality monitoring along the same waterways you run beside.',
  '2026-10-25 07:00:00', '2026-10-25 12:00:00',
  'Sun and Moon Twin Pagoda Plaza', 'No. 1 Binjiang Road', 'Xiangshan', 'Guilin',
  40.00, 0, 180000.00, 2500, 'assets/img/harvest-moon-walk.jpg', 'active', NULL),

 -- ---- Beihai ----
 (4, 1, 'Beihai Silver Beach Family Run', 'beihai-silver-beach-family-run',
  'A 3 km barefoot family run on the sand, with a beach clean-up along the way.',
  'The friendliest run on the calendar: 3 km along Silver Beach with a 1 km toddler dash, a sandcastle competition and a free coconut at the finish. Teams collect litter as they go, so every finisher hands in a full bag. Entry covers a month of community-kitchen meals for one Beihai family.',
  '2026-11-15 08:00:00', '2026-11-15 12:00:00',
  'Silver Beach Boardwalk', 'Yintan Avenue', 'Yinhai', 'Beihai',
  25.00, 0, 90000.00, 2000, 'assets/img/paws-on-parade-fun-run.jpg', 'active', NULL),

 -- ---- Guilin ----
 (1, 2, 'Lijiang Starlight Gala Dinner', 'lijiang-starlight-gala-dinner',
  'A black-tie evening on the riverbank funding a year of water-quality science.',
  'Three hundred guests dine under lanterns on the Guilin riverbank while the Guangxi Youth Orchestra plays and local fishers tell the story of the river they grew up on. The evening includes a four-course menu by chef Qin Ruilan, a live appeal and a pledge paddle auction. Funds cover twelve months of independent water testing at 30 sites.',
  '2026-11-07 18:30:00', '2026-11-07 23:00:00',
  'Lijiang Riverside Pavilion', 'No. 22 Binjiang Road', 'Xiufeng', 'Guilin',
  180.00, 0, 260000.00, 300, 'assets/img/harbour-lights-gala.jpg', 'active', NULL),

 -- ---- Nanning ----
 (2, 2, 'Heart of Nanning Charity Ball', 'heart-of-nanning-charity-ball',
  'An evening of dining and music funding 200 paediatric surgery places.',
  'The Trust''s most important night of the year. Guests hear from three families whose children were treated in the past twelve months, then pledge against a wall of 200 named surgery places. Includes a three-course dinner, a jazz set from the Guangxi Arts University ensemble and a silent auction of donated stays around the province.',
  '2026-12-05 18:00:00', '2026-12-05 22:30:00',
  'Nanning International Convention Centre', 'No. 106 Minzu Avenue', 'Qingxiu', 'Nanning',
  220.00, 0, 320000.00, 420, 'assets/img/midnight-masquerade-ball.jpg', 'active', NULL),

 -- ---- Beihai ----
 (3, 2, 'Beibu Gulf Night Gala', 'beibu-gulf-night-gala',
  'A seaside gala dinner raising funds for the sea-turtle rehabilitation pool.',
  'Dine on the deck above the rehabilitation pool and meet the turtles your donation is treating. Rangers talk through the nesting season, then chef Wei Lian serves a five-course Gulf seafood menu. All proceeds fund the pool''s running costs, satellite tags and the ranger patrols that guard seven nesting beaches.',
  '2026-12-19 18:30:00', '2026-12-19 22:30:00',
  'Beibu Gulf Marine Station', 'No. 5 Haijing Road', 'Haicheng', 'Beihai',
  160.00, 0, 200000.00, 260, 'assets/img/neon-night-gala.jpg', 'active', NULL),

 -- ---- Nanning ----
 (6, 3, 'Bagui Craftsmanship Silent Auction', 'bagui-craftsmanship-silent-auction',
  'Bid quietly on Zhuang brocade, silverwork and hand-dyed cloth from 14 counties.',
  'More than 180 lots, every one made by a named artisan: Zhuang brocade panels, Miao silverwork, hand-painted fan leaf, bamboo weaving and a week-long residency with a master weaver. Bidding opens online a week early and closes on the night. Proceeds fund 60 apprenticeships for young makers in rural Guangxi.',
  '2026-10-17 17:00:00', '2026-10-17 21:00:00',
  'Guangxi Museum of Nationalities', 'No. 11 Qinghuan Road', 'Qingxiu', 'Nanning',
  30.00, 0, 120000.00, 300, 'assets/img/art-for-heart-auction.jpg', 'active', NULL),

 -- ---- Guilin ----
 (1, 3, 'Guilin Landscape Art Auction', 'guilin-landscape-art-auction',
  'A silent auction of South China ink paintings, with all lots donated by the artists.',
  'Fifty painters from across South China have donated work inspired by the karst landscape, from large hanging scrolls to small studies made on the riverbank. Every lot is on show in the gallery for a week before bidding closes, and the artists meet buyers on the closing night. Funds pay for a year of river-bank replanting.',
  '2027-01-16 17:00:00', '2027-01-16 21:00:00',
  'Guilin Art Gallery', 'No. 3 Zhongshan Middle Road', 'Xiufeng', 'Guilin',
  30.00, 0, 140000.00, 240, 'assets/img/spring-bloom-garden-auction.jpg', 'active', NULL),

 -- ---- Liuzhou ----
 (6, 4, 'Sanjiang Dong Chorus Benefit Concert', 'sanjiang-dong-chorus-benefit-concert',
  'The Dong Grand Song chorus in concert - an evening of polyphony in Sanjiang.',
  'The Sanjiang Dong Grand Song ensemble, a national intangible heritage troupe, performs under the drum tower at Chengyang with guests from three neighbouring villages. Every ticket funds an apprenticeship place so that a young singer can learn the repertoire properly. Local oil-tea and rice-wine stalls open from 5 pm.',
  '2026-10-31 17:30:00', '2026-10-31 22:00:00',
  'Chengyang Drum Tower Square', 'Chengyang Township', 'Sanjiang', 'Liuzhou',
  80.00, 0, 130000.00, 1200, 'assets/img/back-to-school-concert.jpg', 'active', NULL),

 -- ---- Nanning ----
 (2, 4, 'Campus Charity Music Night', 'campus-charity-music-night',
  'Student bands from six Guangxi universities on one stage for the children''s ward.',
  'Six student bands play a two-hour set in the Guangxi University auditorium, headlined by the Nanning indie outfit South of the River. Tickets are deliberately cheap so students can bring friends, and every ticket buys a night of family accommodation beside a paediatric ward. Doors 6:30 pm, music from 7 pm.',
  '2026-11-21 18:30:00', '2026-11-21 22:00:00',
  'Guangxi University Auditorium', 'No. 100 University Road', 'Xixiangtang', 'Nanning',
  50.00, 0, 110000.00, 2000, 'assets/img/reef-beats-concert.jpg', 'active', NULL),

 -- ---- Nanning ----
 (4, 5, 'Qingxiu Mountain Charity Walk', 'qingxiu-mountain-charity-walk',
  'A gentle 7 km loop through Qingxiu Mountain - pram and wheelchair friendly.',
  'The route follows the sealed paths through the mountain park, past the dragon-elephant pagoda and the orchid garden, with three rest stops and a free herbal tea tent. Walkers can start any time between 8 and 10 am. Registration funds community-kitchen meals, and every walker who finishes earns a bamboo bookmark.',
  '2026-10-18 08:00:00', '2026-10-18 12:30:00',
  'Qingxiu Mountain Scenic Area', 'No. 19 Qingshan Road', 'Qingxiu', 'Nanning',
  20.00, 0, 70000.00, 3000, 'assets/img/coastal-care-walk.jpg', 'active', NULL),

 -- ---- Beihai ----
 (3, 5, 'Beihai Old Street Coastal Walk', 'beihai-old-street-coastal-walk',
  'Walk the arcade old street then out along the seawall for a turtle-release morning.',
  'Start among the colonial arcades of Beihai Old Street, then follow the seawall east to the release beach, where rangers release rehabilitated turtles back into the Gulf. Guides interpret the mangrove boardwalk along the way. A shuttle returns walkers to the old street for a seafood lunch market.',
  '2026-11-08 08:00:00', '2026-11-08 13:00:00',
  'Beihai Old Street Archway', 'No. 1 Zhuhai Middle Road', 'Haicheng', 'Beihai',
  25.00, 0, 80000.00, 1500, 'assets/img/winter-warmth-walk.jpg', 'active', NULL),

 -- ---- Guilin ----
 (5, 5, 'Longji Terraces Charity Trek', 'longji-terraces-charity-trek',
  'A 9 km trek through the Longji rice terraces to raise funds for mountain schools.',
  'Walk the stone paths between Pingan and Dazhai with a local guide, through some of the oldest rice terraces in China. The route includes the Seven Stars with Moon viewpoint and finishes at a village school where walkers meet the pupils their entry fees support. Lunch is served by the village cooperative.',
  '2026-12-06 08:30:00', '2026-12-06 15:30:00',
  'Longji Rice Terraces', 'Longji Township', 'Longsheng', 'Guilin',
  90.00, 0, 150000.00, 600, 'assets/img/harvest-moon-walk.jpg', 'active', NULL),

 -- ---- Nanning ----
 (4, 6, 'Taste of Yongcheng Food Festival', 'taste-of-yongcheng-food-festival',
  'Sixty stalls, twelve chefs, and every $10 plate turns surplus produce into meals.',
  'Nanning''s chefs cook from produce that would otherwise go to waste, selling tasting plates for a fixed $10. A live rescue challenge shows how a crate of imperfect vegetables becomes forty restaurant meals, and local musicians play between workshops. Each plate funds roughly six meals for a neighbour going without.',
  '2026-10-24 10:00:00', '2026-10-24 21:00:00',
  'Yongjiang Cultural Precinct', 'No. 6 Yonghe Road', 'Jiangnan', 'Nanning',
  10.00, 0, 95000.00, 5000, 'assets/img/taste-of-hope-food-festival.jpg', 'active', NULL),

 -- ---- Liuzhou ----
 (4, 6, 'Liuzhou Luosifen Charity Market', 'liuzhou-luosifen-charity-market',
  'Thirty noodle kitchens, one riverbank, and a bowl of luosifen for every donation.',
  'The city''s best-known noodle houses set up along the riverbank and serve their signature bowl for a fixed donation. A beginner''s tasting lane introduces first-timers to the flavour, and the noodle-makers'' cooperative shows how the rice noodles are made. Every bowl funds two community-kitchen meals.',
  '2026-11-29 11:00:00', '2026-11-29 20:00:00',
  'Liuzhou Riverside Park', 'No. 2 Binjiang East Road', 'Chengzhong', 'Liuzhou',
  15.00, 0, 85000.00, 4000, 'assets/img/lantern-market.jpg', 'active', NULL),

 -- ---- Guilin ----
 (1, 7, 'Lijiang Clean-Up Volunteer Day', 'lijiang-clean-up-volunteer-day',
  'Join the skiff fleet for a morning cleaning 18 km of the Lijiang riverbank.',
  'Volunteers work in teams from six landing points between Guilin and Yangshuo, on foot and aboard the Guardians'' skiff fleet. Gloves, bags, life jackets and a riverbank lunch are provided; every item recovered is logged into the provincial waterway database. Marine scientists join each team to record what is found.',
  '2026-10-04 08:00:00', '2026-10-04 13:00:00',
  'Guilin Waterfront Terminal', 'No. 9 Binjiang Road', 'Xiufeng', 'Guilin',
  0.00, 1, 45000.00, 800, 'assets/img/cleanup.jpg', 'active', NULL),

 -- ---- Baise ----
 (5, 7, 'Mountain School Repair Week', 'mountain-school-repair-week',
  'A week of hands-on building work at a Baise village school - no experience needed.',
  'Volunteers stay with village families and work alongside local carpenters on classrooms, a rainwater tank and a small library. Skilled tradespeople are welcome, but most of the work is painting, shelving and grounds. Accommodation and meals are provided; volunteers cover their own travel to Baise.',
  '2026-12-13 08:00:00', '2026-12-19 17:00:00',
  'Nongmin Village Primary School', 'Nongmin Township', 'Tiandong', 'Baise',
  0.00, 1, 60000.00, 60, 'assets/img/school.jpg', 'active', NULL),

 -- ---- Nanning ----
 (6, 8, 'Zhuang Brocade Charity Market', 'zhuang-brocade-charity-market',
  'A weekend craft market where 90 weavers sell direct and donate every stall fee.',
  'Ninety makers from 14 counties take over the old street for a weekend: brocade, indigo dye, silverwork, bamboo weaving and folk-song performances on the hour. Every stall donates its fee, and the network matches it so young artisans can be paid during their apprenticeship. Demonstrations run all day and children can try the loom.',
  '2026-11-28 10:00:00', '2026-11-29 18:00:00',
  'Old Nanning Craft Street', 'No. 15 Xingning Road', 'Xingning', 'Nanning',
  5.00, 0, 70000.00, 6000, 'assets/img/craft-market.jpg', 'active', NULL),

 -- ---- Wuzhou ----
 (6, 8, 'Wuzhou Arcade Street Charity Market', 'wuzhou-arcade-street-charity-market',
  'A heritage market under the arcades of Wuzhou, raising funds for craft apprenticeships.',
  'The 1920s arcade streets of Wuzhou host 60 stalls of craft, tea and local snack. Guided heritage walks run every hour, and the network''s senior weavers demonstrate the patterns that were once traded down the river. Stall fees and 20% of takings fund apprenticeships for young makers in eastern Guangxi.',
  '2027-01-23 10:00:00', '2027-01-23 18:00:00',
  'Wuzhou Arcade Old Town', 'No. 8 Xiaonan Road', 'Wanxiu', 'Wuzhou',
  5.00, 0, 55000.00, 4000, 'assets/img/craft-market.jpg', 'active', NULL),

 -- ---- Yulin ----
 (2, 5, 'Yulin Winter Warmth Walk', 'yulin-winter-warmth-walk',
  'Walkers raised enough to buy 1,400 winter coats for children in the Yulin hills.',
  'Just over 900 walkers joined the 6 km loop through Yulin''s ring parks and raised enough for 1,400 winter coats plus 300 pairs of school shoes, delivered before the first cold snap. The coats went to children identified by twelve village schools working with the Trust.',
  '2026-08-30 08:30:00', '2026-08-30 12:00:00',
  'Yulin People Park', 'No. 3 Renmin East Road', 'Yuzhou', 'Yulin',
  20.00, 0, 65000.00, 1500, 'assets/img/winter-warmth-walk.jpg', 'active', NULL),

 -- ---- Fangchenggang ----
 (3, 7, 'Fangchenggang Coastal Clean-Up Day', 'fangchenggang-coastal-clean-up-day',
  'Our autumn clean-up lifted 3.1 tonnes of debris off the Fangchenggang coast.',
  'More than 800 volunteers cleared 3.1 tonnes of debris from twelve kilometres of coastline, including 14,000 plastic bottles and 620 metres of discarded fishing net. The haul was logged with the provincial marine debris database and used to brief the city on siting new recycling bins along the seawall.',
  '2026-09-06 08:00:00', '2026-09-06 13:00:00',
  'Bailang Beach', 'Binhai Highway', 'Gangkou', 'Fangchenggang',
  0.00, 1, 40000.00, 900, 'assets/img/cleanup.jpg', 'active', NULL),

 -- ---- Nanning ----
 (4, 2, 'High-Roller Poker Charity Night', 'high-roller-poker-charity-night',
  'An invitation-only poker evening - suspended before publication.',
  'This event was suspended because it promoted gambling, which breaches both the host organisation''s fundraising policy and provincial fundraising guidelines. It is deliberately kept in the database so the suspension rule can be demonstrated: the website never shows it and the API never returns it.',
  '2026-10-14 19:00:00', '2026-10-14 23:30:00',
  'Private Venue', 'Address withheld', 'Qingxiu', 'Nanning',
  250.00, 0, 60000.00, 80, 'assets/img/art-for-heart-auction.jpg', 'suspended', 'Promotes gambling - breaches the fundraising policy');

-- --------------------------------------------------------------------- donations --
-- Aggregated by the API to produce the Goal vs Progress figure on the details page.
INSERT INTO donations (event_id, donor_name, amount, message, donated_at) VALUES
 (1,'Anonymous'                       , 17427.77,'See you at the start line.'                            ,'2026-09-19 17:27:00'),
 (1,'Guangxi Arts Alumni'             ,  7039.64,'Happy to help.'                                        ,'2026-09-17 15:43:00'),
 (1,'Huang Xiaoyu'                    ,  7293.10,''                                                      ,'2026-09-26 19:49:00'),
 (1,'Chen Yu'                         ,  7661.83,''                                                      ,'2026-09-06 15:27:00'),
 (1,'Huang Xiaoyu'                    , 10312.05,'Running with the whole office.'                        ,'2026-09-09 18:20:00'),
 (1,'Yongjiang Neighbours Group'      ,  5815.95,''                                                      ,'2026-09-05 21:00:00'),
 (1,'Huang Xiaoyu'                    , 26222.91,'See you at the start line.'                            ,'2026-09-27 16:28:00'),
 (2,'Deng Hao'                        , 31899.20,'My hometown, my turn to give back.'                    ,'2026-09-17 20:36:00'),
 (2,'Qin Lan'                         , 13002.72,'Keep the river clean.'                                 ,'2026-09-14 19:50:00'),
 (2,'Yongjiang Neighbours Group'      , 15924.01,'Wishing every family well.'                            ,'2026-09-16 11:00:00'),
 (2,'Mo Zhen'                         , 16828.53,'Running with the whole office.'                        ,'2026-09-05 19:36:00'),
 (2,'Mo Zhen'                         , 12132.61,'For the children of my home county.'                   ,'2026-09-04 17:58:00'),
 (2,'Guangxi Arts Alumni'             ,  4209.46,'For the children of my home county.'                   ,'2026-09-02 10:16:00'),
 (2,'Nanning Runners Club'            , 45732.84,'Thank you for what you do.'                            ,'2026-09-21 20:12:00'),
 (3,'Hechi Teachers Association'      ,  8033.29,'In memory of my grandmother.'                          ,'2026-09-04 19:36:00'),
 (3,'Beihai Dive School'              ,  5003.50,''                                                      ,'2026-09-05 18:48:00'),
 (3,'Anonymous'                       ,  4827.33,''                                                      ,'2026-09-18 15:48:00'),
 (3,'Class of 2026 - Guangxi University',  5111.23,'See you at the start line.'                            ,'2026-09-04 17:03:00'),
 (3,'Huang Xiaoyu'                    ,  3216.57,'My hometown, my turn to give back.'                    ,'2026-09-02 12:33:00'),
 (3,'Qin Lan'                         ,  2590.98,'For the children of my home county.'                   ,'2026-09-24 21:45:00'),
 (3,'Yongjiang Neighbours Group'      , 10138.86,'From a former scholarship student.'                    ,'2026-09-09 14:42:00'),
 (4,'Li Meihua'                       , 29996.77,'In memory of my grandmother.'                          ,'2026-09-01 20:15:00'),
 (4,'Class of 2026 - Guangxi University', 18829.51,'Keep the river clean.'                                 ,'2026-09-03 21:54:00'),
 (4,'Class of 2026 - Guangxi University', 14838.43,''                                                      ,'2026-09-25 14:04:00'),
 (4,'Guilin Weavers Guild'            , 36978.33,'From a former scholarship student.'                    ,'2026-09-16 10:27:00'),
 (4,'Anonymous'                       , 24992.21,'Our whole class chipped in.'                           ,'2026-09-08 11:48:00'),
 (4,'Anonymous'                       , 80905.71,'Running with the whole office.'                        ,'2026-09-11 10:36:00'),
 (5,'Nanning Runners Club'            , 27866.39,'See you at the start line.'                            ,'2026-09-19 10:42:00'),
 (5,'Li Meihua'                       ,  9857.16,'Running with the whole office.'                        ,'2026-09-08 19:17:00'),
 (5,'Tang Rui'                        , 14682.11,''                                                      ,'2026-09-02 20:04:00'),
 (5,'Qin Lan'                         , 13182.28,''                                                      ,'2026-09-27 08:54:00'),
 (5,'Guangxi Arts Alumni'             ,  6903.73,'For the children of my home county.'                   ,'2026-09-05 18:30:00'),
 (5,'Huang Xiaoyu'                    , 11386.48,''                                                      ,'2026-09-04 20:07:00'),
 (5,'Yongjiang Neighbours Group'      ,  4760.63,'See you at the start line.'                            ,'2026-09-07 18:09:00'),
 (5,'Zhao Kun'                        , 26504.10,'Happy to help.'                                        ,'2026-09-23 12:14:00'),
 (6,'Deng Hao'                        , 20977.54,'Running with the whole office.'                        ,'2026-09-26 09:33:00'),
 (6,'Chen Yu'                         , 18054.80,'Wishing every family well.'                            ,'2026-09-18 14:02:00'),
 (6,'Qin Lan'                         ,  8573.23,''                                                      ,'2026-09-02 10:56:00'),
 (6,'Qin Lan'                         ,  9131.14,'Happy to help.'                                        ,'2026-09-18 17:52:00'),
 (6,'Hechi Teachers Association'      , 18070.74,'Happy to help.'                                        ,'2026-09-15 21:33:00'),
 (6,'Class of 2026 - Guangxi University',  5234.71,'Happy to help.'                                        ,'2026-09-08 17:12:00'),
 (6,'Yongjiang Neighbours Group'      , 58953.08,'Keep the river clean.'                                 ,'2026-09-05 20:27:00'),
 (7,'Deng Hao'                        ,  7641.88,'Happy to help.'                                        ,'2026-09-23 12:22:00'),
 (7,'Hechi Teachers Association'      ,  9961.94,'For the turtles.'                                      ,'2026-09-14 08:14:00'),
 (7,'Beihai Dive School'              ,  3301.74,'My hometown, my turn to give back.'                    ,'2026-09-01 20:48:00'),
 (7,'Liuzhou Noodle Union'            ,  4248.36,'For the children of my home county.'                   ,'2026-09-23 14:39:00'),
 (7,'Zhuang Song Choir'               ,  5812.87,'My hometown, my turn to give back.'                    ,'2026-09-27 13:22:00'),
 (7,'Anonymous'                       , 20868.08,'Thank you for what you do.'                            ,'2026-09-26 14:42:00'),
 (8,'Li Meihua'                       ,  9354.02,'Our whole class chipped in.'                           ,'2026-09-01 20:31:00'),
 (8,'Hechi Teachers Association'      ,  5139.10,''                                                      ,'2026-09-07 12:51:00'),
 (8,'Anonymous'                       ,  8776.96,''                                                      ,'2026-09-15 09:55:00'),
 (8,'Wei Lin'                         ,  9776.32,'From a former scholarship student.'                    ,'2026-09-16 21:55:00'),
 (8,'Mo Zhen'                         , 35817.67,'Wishing every family well.'                            ,'2026-09-10 10:35:00'),
 (9,'Zhuang Song Choir'               , 24469.98,'From a former scholarship student.'                    ,'2026-09-23 15:08:00'),
 (9,'Wei Lin'                         , 14668.72,''                                                      ,'2026-09-11 17:24:00'),
 (9,'Guilin Weavers Guild'            , 11562.63,'Keep the river clean.'                                 ,'2026-09-17 08:54:00'),
 (9,'Li Meihua'                       ,  8711.35,'In memory of my grandmother.'                          ,'2026-09-02 14:51:00'),
 (9,'Zhuang Song Choir'               ,  5318.67,'Thank you for what you do.'                            ,'2026-09-22 17:37:00'),
 (9,'Hechi Teachers Association'      ,  8136.14,'Keep the river clean.'                                 ,'2026-09-05 13:47:00'),
 (9,'Li Meihua'                       ,  6793.56,'Running with the whole office.'                        ,'2026-09-27 09:39:00'),
 (9,'Mo Zhen'                         , 26085.11,'Keep the river clean.'                                 ,'2026-09-11 08:45:00'),
 (10,'Class of 2026 - Guangxi University',  9408.33,'In memory of my grandmother.'                          ,'2026-09-22 17:56:00'),
 (10,'Hechi Teachers Association'      , 18289.03,'In memory of my grandmother.'                          ,'2026-09-21 17:13:00'),
 (10,'Class of 2026 - Guangxi University',  6338.32,'Thank you for what you do.'                            ,'2026-09-17 18:31:00'),
 (10,'Liuzhou Noodle Union'            , 13915.73,'Proud to support Guangxi.'                             ,'2026-09-23 21:51:00'),
 (10,'Guangxi Arts Alumni'             ,  7873.85,'For the children of my home county.'                   ,'2026-09-12 10:42:00'),
 (10,'Hechi Teachers Association'      , 29093.53,''                                                      ,'2026-09-27 14:55:00'),
 (11,'Yongjiang Neighbours Group'      ,  2819.93,'In memory of my grandmother.'                          ,'2026-09-23 18:27:00'),
 (11,'Beihai Dive School'              ,  3394.51,'Our whole class chipped in.'                           ,'2026-09-25 14:35:00'),
 (11,'Huang Xiaoyu'                    ,  2741.63,'My hometown, my turn to give back.'                    ,'2026-09-14 21:48:00'),
 (11,'Li Meihua'                       ,  4566.41,'For the turtles.'                                      ,'2026-09-25 16:40:00'),
 (11,'Liuzhou Noodle Union'            ,  3749.04,''                                                      ,'2026-09-03 21:56:00'),
 (11,'Zhao Kun'                        ,  1022.03,'Proud to support Guangxi.'                             ,'2026-09-25 08:59:00'),
 (11,'Mo Zhen'                         , 10775.53,'For the children of my home county.'                   ,'2026-09-22 19:59:00'),
 (12,'Bagui Hospital Staff'            ,  5099.40,''                                                      ,'2026-09-26 10:18:00'),
 (12,'Qin Lan'                         ,  6763.21,'Thank you for what you do.'                            ,'2026-09-17 16:09:00'),
 (12,'Hechi Teachers Association'      , 12153.78,''                                                      ,'2026-09-21 17:48:00'),
 (12,'Qin Lan'                         ,  7654.75,'Wishing every family well.'                            ,'2026-09-06 08:19:00'),
 (12,'Nanning Runners Club'            ,  6586.37,'Proud to support Guangxi.'                             ,'2026-09-27 08:48:00'),
 (12,'Guangxi Arts Alumni'             ,  5087.42,'In memory of my grandmother.'                          ,'2026-09-13 15:09:00'),
 (12,'Guilin Weavers Guild'            ,  2487.14,'For the children of my home county.'                   ,'2026-09-15 20:54:00'),
 (12,'Class of 2026 - Guangxi University',  3729.69,'Keep the river clean.'                                 ,'2026-09-19 09:20:00'),
 (12,'Chen Yu'                         , 13525.58,'See you at the start line.'                            ,'2026-09-14 14:28:00'),
 (13,'Bagui Hospital Staff'            ,  9744.38,'See you at the start line.'                            ,'2026-09-15 13:33:00'),
 (13,'Guilin Weavers Guild'            ,  8682.53,'Happy to help.'                                        ,'2026-09-14 19:09:00'),
 (13,'Deng Hao'                        ,  8859.13,''                                                      ,'2026-09-24 17:24:00'),
 (13,'Mo Zhen'                         , 11417.97,'See you at the start line.'                            ,'2026-09-06 16:16:00'),
 (13,'Guilin Weavers Guild'            ,  5398.71,'My hometown, my turn to give back.'                    ,'2026-09-28 18:52:00'),
 (13,'Class of 2026 - Guangxi University',  7856.04,'My hometown, my turn to give back.'                    ,'2026-09-27 21:23:00'),
 (13,'Bagui Hospital Staff'            ,  5261.76,'From a former scholarship student.'                    ,'2026-09-06 09:16:00'),
 (13,'Anonymous'                       , 33116.22,'From a former scholarship student.'                    ,'2026-09-10 17:56:00'),
 (14,'Wei Lin'                         ,  8659.23,'Our whole class chipped in.'                           ,'2026-09-07 10:23:00'),
 (14,'Mo Zhen'                         ,  4955.54,'Wishing every family well.'                            ,'2026-09-28 15:10:00'),
 (14,'Mo Zhen'                         ,  3789.49,'Happy to help.'                                        ,'2026-09-10 08:06:00'),
 (14,'Zhuang Song Choir'               ,  4326.53,'My hometown, my turn to give back.'                    ,'2026-09-19 20:03:00'),
 (14,'Yongjiang Neighbours Group'      ,  1962.31,'See you at the start line.'                            ,'2026-09-26 15:40:00'),
 (14,'Qin Lan'                         , 16452.44,''                                                      ,'2026-09-22 20:29:00'),
 (15,'Zhuang Song Choir'               ,  6879.88,'Proud to support Guangxi.'                             ,'2026-09-21 13:19:00'),
 (15,'Wei Lin'                         , 12793.55,'Happy to help.'                                        ,'2026-09-13 09:58:00'),
 (15,'Qin Lan'                         ,  9171.10,''                                                      ,'2026-09-26 13:05:00'),
 (15,'Yongjiang Neighbours Group'      ,  6356.92,'Our whole class chipped in.'                           ,'2026-09-07 15:32:00'),
 (15,'Mo Zhen'                         , 19762.43,'Happy to help.'                                        ,'2026-09-17 19:21:00'),
 (16,'Qin Lan'                         ,  8763.41,''                                                      ,'2026-09-13 19:09:00'),
 (16,'Guilin Weavers Guild'            ,  5848.33,''                                                      ,'2026-09-18 10:19:00'),
 (16,'Tang Rui'                        ,  4415.91,'See you at the start line.'                            ,'2026-09-04 12:00:00'),
 (16,'Guangxi Arts Alumni'             ,  1526.55,'My hometown, my turn to give back.'                    ,'2026-09-24 20:06:00'),
 (16,'Li Meihua'                       ,  4066.95,'For the turtles.'                                      ,'2026-09-17 08:05:00'),
 (16,'Bagui Hospital Staff'            ,  2765.64,''                                                      ,'2026-09-21 13:22:00'),
 (16,'Guangxi Arts Alumni'             , 10686.27,'From a former scholarship student.'                    ,'2026-09-04 12:21:00'),
 (17,'Anonymous'                       ,  4610.85,'Wishing every family well.'                            ,'2026-09-22 17:06:00'),
 (17,'Beihai Dive School'              ,  5623.43,'Running with the whole office.'                        ,'2026-09-09 18:28:00'),
 (17,'Huang Xiaoyu'                    ,  4272.52,'Proud to support Guangxi.'                             ,'2026-09-17 15:31:00'),
 (17,'Liuzhou Noodle Union'            ,  1302.61,'Running with the whole office.'                        ,'2026-09-15 16:07:00'),
 (17,'Hechi Teachers Association'      ,  1402.36,'For the children of my home county.'                   ,'2026-09-27 13:38:00'),
 (17,'Yongjiang Neighbours Group'      ,  1204.95,'Running with the whole office.'                        ,'2026-09-23 14:49:00'),
 (17,'Class of 2026 - Guangxi University',   789.14,''                                                      ,'2026-09-05 19:22:00'),
 (17,'Li Meihua'                       ,  8663.56,'Keep the river clean.'                                 ,'2026-09-08 15:32:00'),
 (18,'Qin Lan'                         ,  7004.77,'Happy to help.'                                        ,'2026-09-22 20:42:00'),
 (18,'Huang Xiaoyu'                    ,  2091.67,'My hometown, my turn to give back.'                    ,'2026-09-08 14:30:00'),
 (18,'Zhao Kun'                        ,  2644.81,'Keep the river clean.'                                 ,'2026-09-08 08:43:00'),
 (18,'Bagui Hospital Staff'            ,  2403.28,''                                                      ,'2026-09-04 21:30:00'),
 (18,'Chen Yu'                         ,  1274.62,'In memory of my grandmother.'                          ,'2026-09-26 17:20:00'),
 (18,'Bagui Hospital Staff'            , 11978.45,'See you at the start line.'                            ,'2026-09-28 19:28:00'),
 (19,'Beihai Dive School'              ,  5004.74,'Running with the whole office.'                        ,'2026-09-26 10:43:00'),
 (19,'Hechi Teachers Association'      ,  5353.87,'Keep the river clean.'                                 ,'2026-09-10 17:43:00'),
 (19,'Qin Lan'                         ,  2288.02,'Keep the river clean.'                                 ,'2026-09-08 20:29:00'),
 (19,'Guangxi Arts Alumni'             ,  3113.21,'For the children of my home county.'                   ,'2026-09-21 11:39:00'),
 (19,'Zhao Kun'                        ,  1313.51,''                                                      ,'2026-09-23 14:50:00'),
 (19,'Zhao Kun'                        ,  1548.24,'From a former scholarship student.'                    ,'2026-09-11 17:51:00'),
 (19,'Liuzhou Noodle Union'            ,  1163.78,'Keep the river clean.'                                 ,'2026-09-14 17:16:00'),
 (19,'Liuzhou Noodle Union'            ,  5436.64,'For the children of my home county.'                   ,'2026-09-13 11:42:00'),
 (20,'Beihai Dive School'              , 13624.29,'In memory of my grandmother.'                          ,'2026-09-27 15:59:00'),
 (20,'Chen Yu'                         , 10199.07,'From a former scholarship student.'                    ,'2026-09-01 21:34:00'),
 (20,'Zhao Kun'                        ,  4553.85,'My hometown, my turn to give back.'                    ,'2026-09-18 10:54:00'),
 (20,'Bagui Hospital Staff'            ,  2707.29,'For the turtles.'                                      ,'2026-09-05 17:13:00'),
 (20,'Chen Yu'                         ,  2076.67,'From a former scholarship student.'                    ,'2026-09-13 17:02:00'),
 (20,'Li Meihua'                       ,  1545.43,'See you at the start line.'                            ,'2026-09-15 21:24:00'),
 (20,'Deng Hao'                        ,  2004.76,''                                                      ,'2026-09-09 11:45:00'),
 (20,'Nanning Runners Club'            , 13490.48,''                                                      ,'2026-09-23 11:52:00'),
 (21,'Yongjiang Neighbours Group'      ,  3092.46,'Happy to help.'                                        ,'2026-09-25 15:22:00'),
 (21,'Deng Hao'                        ,  3318.25,'In memory of my grandmother.'                          ,'2026-09-17 12:16:00'),
 (21,'Chen Yu'                         ,  2435.99,'Our whole class chipped in.'                           ,'2026-09-25 19:53:00'),
 (21,'Wei Lin'                         ,  1969.85,'My hometown, my turn to give back.'                    ,'2026-09-24 15:56:00'),
 (21,'Class of 2026 - Guangxi University',   725.01,'Keep the river clean.'                                 ,'2026-09-05 17:46:00'),
 (21,'Qin Lan'                         ,  6046.08,'Our whole class chipped in.'                           ,'2026-09-28 18:09:00');

-- ----------------------------------------------------------------- event_updates --
INSERT INTO event_updates (event_id, title, body, posted_at) VALUES
 (1,'Entries pass 1,900 runners'                  ,'We are at 63% of capacity four weeks out - register early to secure your preferred wave.'                    ,'2026-09-10 09:15:00'),
 (1,'New 1 km mini dash added'                    ,'By popular demand, under-8s now have their own wave at 8:30 am with a medal for every finisher.'             ,'2026-09-14 10:25:00'),
 (2,'Route confirmed with the city'               ,'All 12 km are marshalled and the two bridge crossings are closed to traffic for the morning.'                ,'2026-09-10 09:15:00'),
 (3,'Beach clean-up teams filled'                 ,'All 40 litter teams are full, but you can still join the waiting list on the day.'                           ,'2026-09-10 09:15:00'),
 (4,'Chef Qin Ruilan confirmed'                   ,'Our four-course menu is locked in, with vegetarian and fully plant-based options on request.'                ,'2026-09-10 09:15:00'),
 (4,'Auction lots revealed'                       ,'Fourteen lots including a week in Yangshuo and a hand-woven brocade panel.'                                  ,'2026-09-14 10:25:00'),
 (5,'Three families to speak'                     ,'Parents from three counties will share what a night near the ward meant to them.'                            ,'2026-09-10 09:15:00'),
 (6,'Nesting season update'                       ,'Seven nests are being monitored and two turtles are ready for release during the evening.'                   ,'2026-09-10 09:15:00'),
 (7,'Online bidding board live'                   ,'Remote bidders can now follow all 180 lots in real time.'                                                    ,'2026-09-10 09:15:00'),
 (7,'Residency lot added'                         ,'A week with a master weaver in Jingxi is now the headline lot.'                                              ,'2026-09-14 10:25:00'),
 (9,'Second village joins'                        ,'Singers from Mashan will join the chorus for the closing three songs.'                                       ,'2026-09-10 09:15:00'),
 (11,'Three rest stops open'                       ,'Herbal tea and water at each stop, plus a first-aid tent at the pagoda.'                                     ,'2026-09-10 09:15:00'),
 (12,'Turtle release confirmed'                    ,'Two rehabilitated green turtles will be released at 10:30 am on the release beach.'                          ,'2026-09-10 09:15:00'),
 (13,'Village lunch confirmed'                     ,'The Pingan cooperative will serve lunch at the school - vegetarian option available.'                        ,'2026-09-10 09:15:00'),
 (14,'Thirty stalls confirmed'                     ,'The full producer list is on our website, including four new plant-based kitchens.'                          ,'2026-09-10 09:15:00'),
 (16,'Six landing points confirmed'                ,'Teams will work from Guilin to Yangshuo; skiff places are now fully booked.'                                 ,'2026-09-10 09:15:00'),
 (18,'Ninety makers confirmed'                     ,'The final stall list is published - brocade, indigo, silver and bamboo.'                                     ,'2026-09-10 09:15:00');

-- --------------------------------------------------------------- coordinates --
-- Venue coordinates required by the Open-Meteo weather API (Part 6).
-- Stored on the event row so the API can simply read latitude/longitude.
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'nanning-yongjiang-sunrise-fun-run';
UPDATE events SET latitude = 25.2736, longitude = 110.2900 WHERE slug = 'guilin-two-rivers-four-lakes-run';
UPDATE events SET latitude = 21.4733, longitude = 109.1197 WHERE slug = 'beihai-silver-beach-family-run';
UPDATE events SET latitude = 25.2736, longitude = 110.2900 WHERE slug = 'lijiang-starlight-gala-dinner';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'heart-of-nanning-charity-ball';
UPDATE events SET latitude = 21.4733, longitude = 109.1197 WHERE slug = 'beibu-gulf-night-gala';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'bagui-craftsmanship-silent-auction';
UPDATE events SET latitude = 25.2736, longitude = 110.2900 WHERE slug = 'guilin-landscape-art-auction';
UPDATE events SET latitude = 25.7833, longitude = 109.6000 WHERE slug = 'sanjiang-dong-chorus-benefit-concert';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'campus-charity-music-night';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'qingxiu-mountain-charity-walk';
UPDATE events SET latitude = 21.4733, longitude = 109.1197 WHERE slug = 'beihai-old-street-coastal-walk';
UPDATE events SET latitude = 25.7977, longitude = 110.0031 WHERE slug = 'longji-terraces-charity-trek';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'taste-of-yongcheng-food-festival';
UPDATE events SET latitude = 24.3264, longitude = 109.4281 WHERE slug = 'liuzhou-luosifen-charity-market';
UPDATE events SET latitude = 25.2736, longitude = 110.2900 WHERE slug = 'lijiang-clean-up-volunteer-day';
UPDATE events SET latitude = 23.5667, longitude = 107.1167 WHERE slug = 'mountain-school-repair-week';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'zhuang-brocade-charity-market';
UPDATE events SET latitude = 23.4767, longitude = 111.2795 WHERE slug = 'wuzhou-arcade-street-charity-market';
UPDATE events SET latitude = 22.6543, longitude = 110.1818 WHERE slug = 'yulin-winter-warmth-walk';
UPDATE events SET latitude = 21.6140, longitude = 108.3542 WHERE slug = 'fangchenggang-coastal-clean-up-day';
UPDATE events SET latitude = 22.8170, longitude = 108.3665 WHERE slug = 'high-roller-poker-charity-night';

-- ------------------------------------------------------------ registrations --
-- 18 registrations across 12 different events (brief minimum: 10).
-- Note how several events appear more than once: the UNIQUE (event_id, email)
-- key allows the same person on different events, and different people on the
-- same event, but never the same person twice on one event.
-- registration_date is spread over several weeks so the event page can prove it
-- sorts "latest purchase first".
INSERT INTO event_registrations
    (event_id, full_name, email, phone, tickets, registration_date, notes)
VALUES
 -- ---- Nanning Yongjiang Sunrise Fun Run (event 1) ----
 (1,'Huang Xiaoyu' , 'huang.xiaoyu@example.com' , '+86 138 7711 2043', 2, '2026-09-08 09:12:00', 'Running with my office team.'),
 (1,'Chen Yu'      , 'chen.yu@example.com'      , '+86 139 7722 5510', 4, '2026-09-15 20:41:00', 'Two adults and two children.'),
 (1,'Mo Zhen'      , 'mo.zhen@example.com'      , '+86 150 7733 8891', 1, '2026-09-27 07:58:00', NULL),

 -- ---- Guilin Two Rivers Four Lakes Run (event 2) ----
 (2,'Deng Hao'     , 'deng.hao@example.com'     , '+86 137 7734 1120', 3, '2026-09-11 18:05:00', 'Bringing the running club.'),
 (2,'Qin Lan'      , 'qin.lan@example.com'      , '+86 188 7755 3312', 2, '2026-09-24 12:30:00', NULL),

 -- ---- Beihai Silver Beach Family Run (event 3) ----
 (3,'Wei Lin'      , 'wei.lin@example.com'      , '+86 135 7791 4420', 5, '2026-09-19 10:22:00', 'Family of five, youngest is 4.'),

 -- ---- Lijiang Starlight Gala Dinner (event 4) ----
 (4,'Li Meihua'    , 'li.meihua@example.com'    , '+86 186 7712 6677', 2, '2026-09-05 16:47:00', 'Vegetarian menu please.'),
 (4,'Tang Rui'     , 'tang.rui@example.com'     , '+86 133 7788 9900', 6, '2026-09-26 21:15:00', 'Table of six for the company.'),

 -- ---- Heart of Nanning Charity Ball (event 5) ----
 (5,'Zhao Kun'     , 'zhao.kun@example.com'     , '+86 159 7700 1234', 2, '2026-09-13 11:09:00', NULL),

 -- ---- Beibu Gulf Night Gala (event 6) ----
 (6,'He Lian'      , 'he.lian@example.com'      , '+86 177 7799 2468', 4, '2026-09-22 19:38:00', 'Keen to see the turtle release.'),

 -- ---- Bagui Craftsmanship Silent Auction (event 7) ----
 (7,'Mo Zhen'      , 'mo.zhen@example.com'      , '+86 150 7733 8891', 1, '2026-09-17 14:03:00', 'Interested in the brocade lots.'),
 (7,'Wei Lin'      , 'wei.lin@example.com'      , '+86 135 7791 4420', 2, '2026-09-28 09:26:00', NULL),

 -- ---- Sanjiang Dong Chorus Benefit Concert (event 9) ----
 (9,'Qin Lan'      , 'qin.lan@example.com'      , '+86 188 7755 3312', 3, '2026-09-20 17:52:00', 'Coming from Liuzhou for this.'),

 -- ---- Qingxiu Mountain Charity Walk (event 11) ----
 (11,'Huang Xiaoyu', 'huang.xiaoyu@example.com' , '+86 138 7711 2043', 2, '2026-09-25 08:14:00', 'Pram friendly route, thank you.'),

 -- ---- Beihai Old Street Coastal Walk (event 12) ----
 (12,'Chen Yu'     , 'chen.yu@example.com'      , '+86 139 7722 5510', 2, '2026-09-29 13:44:00', NULL),

 -- ---- Longji Terraces Charity Trek (event 13) ----
 (13,'Deng Hao'    , 'deng.hao@example.com'     , '+86 137 7734 1120', 2, '2026-09-30 07:33:00', 'Staying with a village family.'),

 -- ---- Mountain School Repair Week (event 17) ----
 (17,'Tang Rui'    , 'tang.rui@example.com'     , '+86 133 7788 9900', 1, '2026-09-06 20:11:00', 'I can help with carpentry.');

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
--  END OF SCRIPT
-- =====================================================================================
