/**
 * weatherController.js - proxies the free Open-Meteo forecast API (Part 6).
 * Reads venue coordinates from the database, fetches a 7-day forecast and turns
 * the WMO weather codes into plain text and an icon for the UI.
 * Endpoint: GET /api/weather?event_id=1 (or ?latitude=&longitude=)
 */

'use strict';

const db = require('../event_db');
const v = require('./validators');

/** Open-Meteo endpoint - free, no key, no registration. */
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

/** How long we are prepared to wait for the external service. */
const TIMEOUT_MS = 8000;

/**
 * The weather_code -> description table straight from the brief, extended with
 * the remaining WMO codes so the widget never shows a raw number.
 */
const WEATHER_CODES = {
    0:    { text: 'Clear sky',                          icon: '☀️' },
    1:    { text: 'Mainly clear',                       icon: '🌤️' },
    2:    { text: 'Partly cloudy',                      icon: '⛅' },
    3:    { text: 'Overcast',                           icon: '☁️' },
    45:   { text: 'Fog',                                icon: '🌫️' },
    48:   { text: 'Depositing rime fog',                icon: '🌫️' },
    51:   { text: 'Light drizzle',                      icon: '🌦️' },
    53:   { text: 'Moderate drizzle',                   icon: '🌦️' },
    55:   { text: 'Dense drizzle',                      icon: '🌧️' },
    56:   { text: 'Light freezing drizzle',             icon: '🌧️' },
    57:   { text: 'Dense freezing drizzle',             icon: '🌧️' },
    61:   { text: 'Light rain',                         icon: '🌦️' },
    63:   { text: 'Moderate rain',                      icon: '🌧️' },
    65:   { text: 'Heavy rain',                         icon: '🌧️' },
    66:   { text: 'Light freezing rain',                icon: '🌧️' },
    67:   { text: 'Heavy freezing rain',                icon: '🌧️' },
    71:   { text: 'Light snow fall',                    icon: '🌨️' },
    73:   { text: 'Moderate snow fall',                 icon: '🌨️' },
    75:   { text: 'Heavy snow fall',                    icon: '❄️' },
    77:   { text: 'Snow grains',                        icon: '🌨️' },
    80:   { text: 'Light rain showers',                 icon: '🌦️' },
    81:   { text: 'Moderate rain showers',              icon: '🌧️' },
    82:   { text: 'Violent rain showers',               icon: '⛈️' },
    85:   { text: 'Light snow showers',                 icon: '🌨️' },
    86:   { text: 'Heavy snow showers',                 icon: '❄️' },
    95:   { text: 'Thunderstorm: slight or moderate',   icon: '⛈️' },
    96:   { text: 'Thunderstorm with slight hail',      icon: '⛈️' },
    99:   { text: 'Thunderstorm with heavy hail',       icon: '⛈️' }
};

/** Falls back to a neutral label so an unknown code never reaches the user. */
function describe(code) {
    const entry = WEATHER_CODES[Number(code)];
    return entry || { text: 'Unsettled conditions', icon: '🌡️' };
}

/**
 * GET /api/weather?event_id=1
 * Reads the venue coordinates from MySQL, calls Open-Meteo and returns a
 * tidy 7 day forecast the event page can render directly.
 */
async function getEventWeather(req, res, next) {
    try {
        const { event_id: eventId, latitude, longitude, days } = req.query;

        let lat = null;
        let lon = null;
        let eventLabel = 'the venue';

        if (eventId !== undefined && String(eventId) !== '') {
            if (!v.isPositiveInt(eventId)) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Invalid event_id. It must be a positive whole number.' }
                });
            }

            const event = await db.queryOne(
                `SELECT event_id, event_name, event_date, city, venue, latitude, longitude
                 FROM events WHERE event_id = ?`,
                [Number(eventId)]
            );

            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: { message: `No charity event found with id ${eventId}.` }
                });
            }
            if (event.latitude === null || event.longitude === null) {
                return res.status(404).json({
                    success: false,
                    error: { message: `No coordinates are stored for "${event.event_name}", so no forecast is available.` }
                });
            }

            lat = Number(event.latitude);
            lon = Number(event.longitude);
            eventLabel = event.event_name;
        } else {
            // Allow a raw lat/lng pair too - handy for testing in the browser.
            const latCheck = v.coordinate(latitude, 'latitude', 90);
            const lonCheck = v.coordinate(longitude, 'longitude', 180);
            if (!latCheck.valid || !lonCheck.valid || latCheck.value === null || lonCheck.value === null) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Provide either event_id, or both latitude and longitude.' }
                });
            }
            lat = latCheck.value;
            lon = lonCheck.value;
        }

        const forecastDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), 14);

        // ---- call the external API ------------------------------------------
        const url = new URL(OPEN_METEO);
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lon));
        url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
        url.searchParams.set('timezone', 'auto');
        url.searchParams.set('forecast_days', String(forecastDays));

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let payload;
        try {
            const response = await fetch(url.toString(), { signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) {
                return res.status(502).json({
                    success: false,
                    error: { message: `The weather service responded with status ${response.status}.` }
                });
            }
            payload = await response.json();
        } catch (error) {
            clearTimeout(timer);
            const timedOut = error && error.name === 'AbortError';
            return res.status(timedOut ? 504 : 502).json({
                success: false,
                error: {
                    message: timedOut
                        ? 'The weather service did not answer in time. Please try again shortly.'
                        : 'Could not reach the weather service. Check the internet connection and try again.'
                }
            });
        }

        // ---- translate the raw numbers into something a visitor can read ----
        const daily = (payload && payload.daily) || {};
        const dates = daily.time || [];

        const forecast = dates.map((date, index) => {
            const code = daily.weather_code ? daily.weather_code[index] : null;
            const info = describe(code);
            return {
                date,
                weather_code: code === undefined || code === null ? null : Number(code),
                description: info.text,
                icon: info.icon,
                temp_max: daily.temperature_2m_max ? daily.temperature_2m_max[index] : null,
                temp_min: daily.temperature_2m_min ? daily.temperature_2m_min[index] : null,
                rain_chance: daily.precipitation_probability_max ? daily.precipitation_probability_max[index] : null
            };
        });

        res.status(200).json({
            success: true,
            source: 'Open-Meteo (https://api.open-meteo.com) - external API, Part 6',
            event: eventLabel,
            location: { latitude: lat, longitude: lon },
            timezone: payload.timezone || null,
            units: payload.daily_units || null,
            count: forecast.length,
            data: forecast
        });
    } catch (error) {
        next(error);
    }
}

module.exports = { getEventWeather, WEATHER_CODES };
