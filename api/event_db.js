/**
 * event_db.js - the one place the API talks to MySQL.
 * Exposes query(), queryOne() and getConnection() so credentials, the
 * connection pool and error handling are defined in a single file. All SQL
 * elsewhere uses `?` placeholders, which prevents SQL injection.
 */

'use strict';

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables from the .env file that sits next to this file.
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * Connection settings.
 * Values are read from the environment (`.env`) but fall back to the local
 * development defaults so the project runs straight after `npm install`.
 */
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'charityevents_a3_db',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,   // max simultaneous connections
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4',
    // Return DATE/DATETIME columns as strings rather than JS Date objects so the
    // JSON sent to the browser is predictable and timezone-safe.
    dateStrings: true,
    decimalNumbers: false
};

/**
 * The shared connection pool. Created once when the module is first required
 * and re-used by the whole application.
 */
const pool = mysql.createPool(dbConfig);

/**
 * Run a parameterised SELECT / INSERT / UPDATE.
 *
 * @param {string} sql     SQL statement containing `?` placeholders.
 * @param {Array}  params  Values bound to the placeholders (safe from injection).
 * @returns {Promise<Array>} The rows returned by MySQL.
 */
async function query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

/**
 * Run a single read query and return the first row, or `null` when the result
 * set is empty. Used by the "get one event by id" endpoint.
 *
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<Object|null>}
 */
async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Borrow a dedicated connection from the pool. Needed when several statements
 * must run inside one transaction (used by Assessment 3's write endpoints).
 *
 * @returns {Promise<import('mysql2/promise').PoolConnection>}
 */
async function getConnection() {
    return pool.getConnection();
}

/**
 * Verifies that the credentials in .env really reach MySQL.
 * Called once at server start-up so a wrong password fails loudly and early
 * instead of producing a confusing error later during a request.
 *
 * @returns {Promise<boolean>} true when the handshake succeeded.
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
        connection.release();
        console.log(`[event_db] Connected to MySQL  ->  database "${rows[0].db}" (server ${rows[0].version})`);
        return true;
    } catch (error) {
        console.error('[event_db] MySQL connection FAILED:', error.message);
        console.error('[event_db] Check DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME in .env');
        return false;
    }
}

/**
 * Closes the pool gracefully. Used by the SIGINT handler in server.js and by
 * unit-test runners so the Node process can actually exit.
 */
async function closePool() {
    await pool.end();
}

module.exports = {
    pool,
    query,
    queryOne,
    getConnection,
    testConnection,
    closePool,
    dbConfig
};
