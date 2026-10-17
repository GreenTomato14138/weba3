/**
 * validators.js - shared input validation for the write endpoints.
 * Each helper returns { valid: true, value } or { valid: false, message } so a
 * controller can reject bad input with a clear 400 before any SQL is built.
 * This is a first line of defence alongside the parameterised queries used in
 * event_db.js, not a replacement for them.
 */

'use strict';

/** True for 1 .. 9999999999 - anything else is not a primary key. */
function isPositiveInt(value) {
    return /^[1-9][0-9]{0,9}$/.test(String(value));
}

/** Trims and collapses runs of whitespace; returns '' for non-strings. */
function clean(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Required text field.
 * @param {*}      value
 * @param {string} label   human readable name used in the error message
 * @param {number} min     minimum length
 * @param {number} max     maximum length
 */
function requiredText(value, label, min = 1, max = 255) {
    const text = clean(value);
    if (text === '') return { valid: false, message: `${label} is required.` };
    if (text.length < min) return { valid: false, message: `${label} must be at least ${min} characters.` };
    if (text.length > max) return { valid: false, message: `${label} must be ${max} characters or fewer.` };
    return { valid: true, value: text };
}

/**
 * Optional text field - an empty value simply becomes null.
 */
function optionalText(value, label, max = 255) {
    const text = clean(value);
    if (text === '') return { valid: true, value: null };
    if (text.length > max) return { valid: false, message: `${label} must be ${max} characters or fewer.` };
    return { valid: true, value: text };
}

/**
 * Email address. Deliberately a simple, permissive pattern: the goal is to
 * catch typos, not to police every RFC 5322 corner case.
 */
function email(value) {
    const text = clean(value).toLowerCase();
    if (text === '') return { valid: false, message: 'Email address is required.' };
    if (text.length > 160) return { valid: false, message: 'Email address is too long.' };
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(text)) {
        return { valid: false, message: 'Please enter a valid email address (e.g. name@example.com).' };
    }
    return { valid: true, value: text };
}

/**
 * Phone number: digits, spaces, +, -, ( ) only. At least 6 digits.
 */
function phone(value) {
    const text = clean(value);
    if (text === '') return { valid: false, message: 'Phone number is required.' };
    if (text.length > 40) return { valid: false, message: 'Phone number is too long.' };
    if (!/^[+()\-\s\d]{6,40}$/.test(text)) {
        return { valid: false, message: 'Phone number may only contain digits, spaces and + - ( ).' };
    }
    if (text.replace(/\D/g, '').length < 6) {
        return { valid: false, message: 'Phone number must contain at least 6 digits.' };
    }
    return { valid: true, value: text };
}

/**
 * A whole number inside [min, max]. Used for ticket quantities and prices.
 */
function integerInRange(value, label, min, max) {
    const num = Number(value);
    if (value === '' || value === null || value === undefined) {
        return { valid: false, message: `${label} is required.` };
    }
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
        return { valid: false, message: `${label} must be a whole number.` };
    }
    if (num < min || num > max) {
        return { valid: false, message: `${label} must be between ${min} and ${max}.` };
    }
    return { valid: true, value: num };
}

/**
 * A decimal number >= 0 with at most two decimal places (money).
 */
function money(value, label, max = 99999999) {
    const num = Number(value);
    if (value === '' || value === null || value === undefined) {
        return { valid: false, message: `${label} is required.` };
    }
    if (!Number.isFinite(num) || num < 0) {
        return { valid: false, message: `${label} must be zero or more.` };
    }
    if (num > max) return { valid: false, message: `${label} is too large.` };
    return { valid: true, value: Math.round(num * 100) / 100 };
}

/**
 * MySQL DATE or DATETIME string. Accepts "2026-10-11" and "2026-10-11 18:30".
 */
function dateTime(value, label) {
    const text = clean(value);
    if (text === '') return { valid: false, message: `${label} is required.` };
    // Accept YYYY-MM-DD or YYYY-MM-DD HH:MM(:SS)
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
    if (!match) return { valid: false, message: `${label} must look like YYYY-MM-DD or YYYY-MM-DD HH:MM.` };
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return { valid: false, message: `${label} is not a real date.` };
    // Guard against impossible dates such as 2026-02-31 silently rolling over.
    if (parsed.getFullYear() !== Number(y) || parsed.getMonth() + 1 !== Number(m) || parsed.getDate() !== Number(d)) {
        return { valid: false, message: `${label} is not a real date.` };
    }
    return { valid: true, value: `${y}-${m}-${d} ${hh}:${mm}:${ss}` };
}

/**
 * One value out of an allowed list (used for enums such as event status).
 */
function oneOf(value, label, allowed) {
    const text = clean(value).toLowerCase();
    if (!allowed.includes(text)) {
        return { valid: false, message: `${label} must be one of: ${allowed.join(', ')}.` };
    }
    return { valid: true, value: text };
}

/**
 * Optional geographic coordinate (for the Open-Meteo weather API).
 * Empty input is allowed and becomes null; anything out of range is rejected.
 */
function coordinate(value, label, limit) {
    if (value === '' || value === null || value === undefined) return { valid: true, value: null };
    const num = Number(value);
    if (!Number.isFinite(num) || num < -limit || num > limit) {
        return { valid: false, message: `${label} must be a number between -${limit} and ${limit}.` };
    }
    return { valid: true, value: num };
}

/**
 * Runs a list of { field, result } pairs and collects every failure.
 * Returning ALL problems at once is much friendlier than failing on the first.
 *
 * @param {Array<{field:string, result:{valid:boolean,message?:string}}>} checks
 * @returns {{ok:boolean, errors:Object<string,string>}}
 */
function collect(checks) {
    const errors = {};
    checks.forEach(({ field, result }) => {
        if (!result.valid) errors[field] = result.message;
    });
    return { ok: Object.keys(errors).length === 0, errors };
}

module.exports = {
    isPositiveInt,
    clean,
    requiredText,
    optionalText,
    email,
    phone,
    integerInRange,
    money,
    dateTime,
    oneOf,
    coordinate,
    collect
};
