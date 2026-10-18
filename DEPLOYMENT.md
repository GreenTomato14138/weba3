# Deploying to SCU cPanel (Part 5)

This is **PROG2002 Assessment 3**. Each student deploys to **their own** cPanel
account (per the brief). Credentials arrive by SCU email — never share them with
your team member.

The two front-ends are **Angular 22** applications, so they must be `ng build`-ed
into static files first; they are NOT plain HTML/CSS/JS folders.

---

## 0. This deployment's actual details (already deployed on 2026-10-16)

| Item | Value |
|---|---|
| cPanel login | `bliu21` at `https://24832410.it.scu.edu.au:2083` (password reset via https://reset.it.scu.edu.au) |
| Live site (visitor) | https://24832410.it.scu.edu.au |
| Live site (admin) | https://24832410.it.scu.edu.au/admin/ (trailing slash required) |
| Live API | https://24832410.it.scu.edu.au/apiapp/api/health → `{"success":true,...}` |
| Database | `bliu21_bliu21_charity` (cPanel double-prefixes the name) |
| DB user | `bliu21_bliu21_dbuser` |
| SQL import | use `api/database/charityevents_a3_db_cpanel.sql` on cPanel (utf8mb4_unicode_ci, includes `USE bliu21_bliu21_charity;`); keep the original SQL for local/GitHub |
| Extra env var | `SUBPATH_PREFIX=/apiapp` — makes the API strip the cPanel sub-path prefix |

Verified live data: 17 events, 6 charities, 145 supporters, $1,496,421.50 raised.

> Note: the root `public_html/.htaccess` must exempt `/apiapp/` from the SPA
> rewrite (`RewriteCond %{REQUEST_URI} !^/apiapp/`), otherwise API calls are
> rewritten to index.html and the front-end shows "Http failure during parsing".

---

## 1. Database

1. cPanel → **MySQL Databases** → create a database, e.g. `scuXXXX_charity`.
2. Create a user and a password, then add the user to the database with
   **ALL PRIVILEGES**.
3. Open **phpMyAdmin**, select the new database, choose **Import**, and upload
   `project/api/database/charityevents_a3_db.sql`.
4. Press **Go**. You should finish with six tables and 17 registrations.

> cPanel prefixes database names with your account name. Whatever the final name
> is, put it in `DB_NAME`.

---

## 2. API (Node.js app)

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Fill in:
   * Node.js version: the newest available
   * Application mode: **Production**
   * Application root: `api` (the folder you uploaded)
   * Application URL: pick a subdomain or path
   * Application startup file: `server.js`
3. Upload the `api` folder (without `node_modules`) and press
   **Run NPM Install**.
4. Add the environment variables (or edit `.env` on the server):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=bliu21_bliu21_dbuser
DB_PASSWORD=...
DB_NAME=bliu21_bliu21_charity
ALLOWED_ORIGINS=https://24832410.it.scu.edu.au
NODE_ENV=production
SUBPATH_PREFIX=/apiapp
```

5. Press **Restart**. Open `https://24832410.it.scu.edu.au/apiapp/api/health` —
   you should see `{"success":true,...}`.

---

## 3. The two Angular websites

Both are **Angular 22** apps that must be compiled to static files:

```bash
# On your local machine, inside each Angular project:
cd clientside && npm install && ng build      # -> dist/clientside/browser
cd adminside && npm install && ng build       # -> dist/adminside/browser
```

Then upload the compiled output:

```
public_html/         -> contents of dist/clientside/browser
public_html/admin/   -> contents of dist/adminside/browser
```

### Pointing the sites at the deployed API

On cPanel the API no longer runs on `localhost:3000`. Change the base URL in each
front-end's `src/app/services/api.service.ts` before building:

```ts
export const API_BASE_URL = 'https://your-app-url/api';
```

(There is no `config.js` — the URL is the `API_BASE_URL` constant. Rebuild after
changing it, then re-upload the `dist/.../browser` folder.)

### CORS

Add both site origins to `ALLOWED_ORIGINS` in the API's `.env`, then restart the
Node app, otherwise the browser will block the requests.

---

## 4. Submission checklist (Deliverables)

- [ ] `/api/health` returns 200 on the live server
- [ ] Home, search and event pages load and show data
- [ ] `register` page submits a booking successfully
- [ ] The admin list shows upcoming, past **and** suspended events
- [ ] Creating, updating and deleting an event all work
- [ ] Deleting an event that has bookings shows the blocked message
- [ ] The weather strip appears on the event page
- [ ] Three source zips: `bliu21A3-clientside.zip`, `bliu21A3-adminside.zip`, `bliu21A3-api.zip`
- [ ] GitHub repository link in the submission (private repo; invite marker as collaborator)
- [ ] Demo video (max 15 min) uploaded to SCU OneDrive with a shareable link
- [ ] Peer evaluation form emailed to the tutor (title `PROG2002_A3_[Team_ID]_[Member_name]`)
- [ ] Project documentation included
- [ ] GenAI use declaration (Option A or B) included in the submission
