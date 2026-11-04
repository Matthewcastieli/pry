# Projecte Solidari · El Far

El Far is a small Catalan-language PWA prototype for creating and viewing local safety alerts. It is an educational demo, not an emergency service. Call 112 directly in an immediate emergency.

This folder is the main version. `apache-ready\` is a separate, simplified copy prepared for deployment. Each version has its own page, JavaScript, stylesheet, service worker, PHP API and manifest.

## Run and check the project

Run these commands in PowerShell from the project root. PHP must be installed and available as `php`, with the `mbstring` extension enabled for the API's text cleanup.

```powershell
php -S 127.0.0.1:8000
```

Starts PHP's development web server from the current folder. Keep the terminal open and visit `http://127.0.0.1:8000`. Press `Ctrl+C` in that terminal to stop it.

```powershell
php -S 127.0.0.1:8000 -t apache-ready
```

Starts the same server with `apache-ready\` as its document root. Visit the same local URL to try the deployable copy.

```powershell
php -l api\alerts.php
php -l apache-ready\api\alerts.php
```

Checks the syntax of each PHP API file; `-l` means “lint only” and does not run the API. There is no package install, build, or test-runner command because this project has no package manifest or test suite.

The browser needs `localhost` or HTTPS for geolocation and service workers. The PHP built-in server is for local development, not public production hosting.

## Main project files

- `index.html` — main app page and its interface elements/IDs.
- `app.js` — main app behavior; function reference is below.
- `styles-readable.css` — stylesheet loaded by the main page.
- `manifest.webmanifest` — install name, colors, display mode and icon.
- `sw.js` — offline cache for the main app.
- `icons\icon.svg` — app icon.
- `api\alerts.php` — demonstration GET/POST API.
- `storage\` — server-side demo data location. `storage\.htaccess` denies direct web access to files on Apache; PHP's built-in development server does not read `.htaccess` files.
- `apache-ready\` — separate deployable version; see its README for its own file and function guide.

### Old or inactive root files

The root `index.html` does not load `state.js`, `storage.js`, `data.js`, `map.js`, or `styles.css`. Those files are remnants of an earlier split-up implementation. `styles.css.new` is also unused. They are not included in the root service-worker cache. Delete them only if you no longer need them for reference; they do not power the current root page.

## Main app function reference (`app.js`)

### State and user trust

- `toast(message)` — displays a temporary status message.
- `setAlertTypeBadge()` — updates the form heading and normal/urgent badge.
- `getUserTrustMap()` — reads the saved per-user trust-score object, using an empty object if its stored JSON is invalid.
- `getUserTrustScore(userName)` — gets a user's score or the default score of 50.
- `setUserTrustScore(userName, score)` — clamps and saves a score between 0 and 100.
- `updateTrustBadge(userName)` — updates the score and its low/mid/high visual state.
- `getCurrentUserName()` — chooses the entered, saved, or default user name and stores it.
- `adjustUserTrust(userName, delta)` — changes the score and refreshes the badge.

### Local alerts and report flow

- `getSharedAlerts()` — reads alerts saved for the local map.
- `readStoredArray(key)` — safely reads a JSON array from `localStorage`; malformed or non-array data becomes an empty array.
- `saveSharedAlerts(alerts)` — saves the local map-alert array.
- `openReport(isUrgent)` — opens the report form and optionally starts location lookup.
- `getRiskLevel()` — reads the selected risk level.
- `validateSafetyChecks(options)` — checks the confirmation boxes, urgent/risk consistency, trust rules, or the quick-send confirmation.
- `createAlertRecord(type)` — builds an alert object with user, risk, location and creation time.
- `sendAlertToServer(data)` — POSTs an alert to `api\alerts.php`; if the request fails, queues it locally as pending.
- `persistAlertRecord(data, options)` — updates trust, local alert/draft lists and the confirmation UI after a send.
- `saveDraftAlert()` — saves the current form as an alert to revisit later.

### Emergency button and location

- `startHold(event)` — starts the three-second emergency-button hold.
- `endHold()` — cancels the hold timer and clears its visual state.
- `locate()` — requests browser geolocation, updates the form and keeps coordinates current while the page is open.
- The normal button's click handler obtains location, asks for a quick confirmation and sends a normal alert.
- The urgent button's pointer/click handlers support a three-second hold or two quick taps.
- The form submit handler validates the full form, sends the report and notes that selected photos/audio are not uploaded.
- The locate, save-draft, cancel and return-home handlers perform their named UI actions.

### Map and saved-alert rendering

- `normalizeAlert(entry)` — validates/coerces an alert into the map's standard shape.
- `getLocalAlerts()` — combines locally pending and locally shared alerts.
- `getCurrentAlerts()` — retrieves server alerts and combines them with local alerts; uses local/fallback examples if the API is unavailable.
- `projectToMap(lat, lng)` — projects coordinates into positions on the illustrative map.
- `renderLiveMap()` — renders alert markers, labels, list entries and the active count.
- `getMyAlerts()` — loads saved alerts/drafts.
- `saveMyAlerts(alerts)` — stores that list.
- `renderMyAlerts()` — renders saved alerts and reopens a selected item in the form. It uses text nodes for user-provided content rather than interpreting it as HTML.
- The install-prompt handler displays the install button when the browser supports the PWA prompt; its click handler requests installation.
- The startup code restores the saved user name, initially renders the map and saved alerts, refreshes the map every 20 seconds, and registers the service worker outside `file:` URLs.

## Service-worker behavior (`sw.js`)

The cache has a versioned name so new releases replace the previous El Far cache. Installation precaches only the app page, active CSS/JS, manifest and icon. The PHP API is deliberately not cached, so alert requests stay current. Activation removes only older `elfar-` caches and claims the app's open pages. GET requests for same-origin static resources use cache-first behavior; if a page navigation fails offline, the cached home page is returned. Other failed requests remain errors.

## PHP API (`api\alerts.php`)

- `GET api/alerts.php` — returns up to 20 newest alerts from `storage\alerts.json`.
- `POST api/alerts.php` — accepts a JSON alert, checks required description/type, cleans the description and appends the record.
- Other methods receive HTTP 405. Invalid or incomplete data receives HTTP 400. Storage failures receive HTTP 500.
- The `usort` callback orders alerts by received/created timestamp.

The API is a demo endpoint. It has no authentication and must not be used to handle real emergency reports.

## Data and privacy

Browser `localStorage` keys include:

- `far_user_name` — last-used name.
- `far_user_trust` — local trust scores.
- `far_pending_alerts` — alerts queued when the API cannot be reached.
- `far_shared_alerts` — locally available map alerts.
- `far_my_alerts` — saved alerts/drafts.

Data stored in browser storage belongs to that browser/device. The PHP API stores submitted alerts in a JSON file on the server. Photos and audio can be selected in the main version but are not uploaded.

## Safety and limitations

This prototype does not notify El Far or emergency services, and it does not call 112 automatically. Do not use it as an operational emergency system. The example map alerts and coordinates are illustrative.
