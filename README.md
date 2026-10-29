# 57th NITP International Conference — City Walk Dashboard

A responsive React + Leaflet web map and participant insights dashboard. It uses the supplied NITP logo, digitised GeoJSON walking track and three KML waypoints (Airport Hotel, NITP Secretariat, JJT Park).

## Features
- Participant check-in before the route page (first name, gender, NITP chapter/state).
- 36 Nigerian states plus the Federal Capital Territory in alphabetical order.
- Interactive OpenStreetMap with the route and start / midway / final-stop markers.
- Optional GPS tracking, elapsed time, approximate distance and walking speed; GPS only starts after a participant taps **Start walk** and grants browser permission.
- Aggregate dashboard: registration count, completed walks, average distance/duration, gender distribution, chapter participation and movement insights.
- GitHub Contents API storage through a Vercel serverless function. The GitHub token is server-side and must never be added to frontend code.
