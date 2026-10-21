# 57th NITP International Conference — City Walk Dashboard

A responsive React + Leaflet web map and participant insights dashboard. It uses the supplied NITP logo, digitised GeoJSON walking track and three KML waypoints (Airport Hotel, NITP Secretariat, JJT Park).

## Features
- Participant check-in before the route page (first name, gender, NITP chapter/state).
- 36 Nigerian states plus the Federal Capital Territory in alphabetical order.
- Interactive OpenStreetMap with the route and start / midway / final-stop markers.
- Optional GPS tracking, elapsed time, approximate distance and walking speed; GPS only starts after a participant taps **Start walk** and grants browser permission.
- Aggregate dashboard: registration count, completed walks, average distance/duration, gender distribution, chapter participation and movement insights.
- GitHub Contents API storage through a Vercel serverless function. The GitHub token is server-side and must never be added to frontend code.

## Deploy to GitHub + Vercel
1. Create a **private GitHub repository** for this project and upload the project files (contents of this folder, not the parent folder).
2. In the repository, create `data/participants.json` with this initial content:
   ```json
   { "updatedAt": null, "participants": [] }
   ```
3. Create a GitHub fine-grained personal access token restricted to this repository with **Contents: Read and write** permission. Keep it secret.
4. Import the repository into Vercel. Add these Environment Variables in **Vercel → Project → Settings → Environment Variables**:
   - `GITHUB_TOKEN` = the token from step 3
   - `GITHUB_OWNER` = GitHub username or organisation owning the repository
   - `GITHUB_REPO` = repository name
   - `GITHUB_BRANCH` = `main` (or your default branch)
   - `GITHUB_DATA_PATH` = `data/participants.json`
5. Redeploy after adding environment variables. Test registration, then confirm a commit updates `data/participants.json` in GitHub.

## Important notes before public launch
- **Privacy:** participant names and GPS tracks are personal data. Keep the repository private. The public dashboard endpoint returns aggregate-friendly records only; it does not expose names or raw tracks. However, this starter is not a full identity/authentication system and the write endpoint needs production hardening (rate limits, server-side validation, anti-spam controls, and an administrator-only dashboard) before use with a large public audience.
- **GPS behaviour:** tracking requires HTTPS (Vercel provides it), permission, and a device/browser with location services. The browser may pause location updates if the screen sleeps or the tab is backgrounded. Ask participants to keep the page open and phone awake. GPS distance/speed are estimates and can be affected by urban-canyon accuracy. Average speed includes pauses unless you add pause/resume logic.
- **GitHub as storage:** this is suitable for a small event prototype, not a high-concurrency database. Simultaneous writes may conflict because GitHub Contents API requires a file SHA. For larger events, use a database such as Supabase or Vercel Postgres and export a copy to GitHub if required.
- **Registration gate:** the app provides a registration page, but its route/dashboard URLs are not an access-control boundary. If the conference needs strict access control, add server-side sessions and protect route/dashboard endpoints.
- **Chapter options:** the dropdown contains Nigeria’s 36 states in alphabetical order. The FCT is intentionally excluded to match the requested list.

## Local development
```bash
npm install
npm run dev
```
The front end can be previewed locally, but participant writes require the Vercel API and the environment variables above. For API testing locally, use `vercel dev` after installing the Vercel CLI and configuring local environment variables.

## Route files
- `public/data/route.geojson` — supplied digitised walking track.
- `public/data/start.kml` — Airport Hotel start point.
- `public/data/first-stop.kml` — NITP Secretariat stop.
- `public/data/final-stop.kml` — JJT Park final stop.
- `nitp-logo.jpg` — supplied NITP logo.

The route file reports `DIST_KM: 3.0` and `DURATION_H: 0.6`; the UI uses those as planned-route estimates. GPS distance and elapsed time are computed separately for each participant.
