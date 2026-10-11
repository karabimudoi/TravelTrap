# Travel Trap Detector — Hackathon Prototype

A full-stack, dependency-free prototype for detecting potentially unfair travel fares, viewing local traveller scam alerts on a map, submitting community reports, and using a simple AI-style safety assistant.

## What is included

- **Fare Analyzer**: calculates fair range, deviation, risk, explanation, and negotiation phrase.
- **Traveller Scam Map**: Leaflet/OpenStreetMap map with seeded New Delhi scam alerts.
- **Community Reports**: submit reports and see them instantly on the map/feed.
- **AI Safety Assistant**: rule-based assistant that uses the selected city and fare result.
- **No API keys needed**: works locally with Node.js only.

## Run locally

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:

```bash
node backend/server.js
```

4. Open `http://localhost:3000` in Chrome.

## Deploy / upload

- If the hackathon platform supports a **ZIP upload**, zip this whole `travel-trap-detector` folder and upload it.
- If it supports a **GitHub repository**, upload all files to a repository and use the run command:

```bash
node backend/server.js
```

- If it supports **static sites only**, deploy the `frontend` folder, but note that fare analysis and report submission need the backend. The app is designed for a Node.js-compatible host.

## Production upgrades

Replace demo data with official tariffs and moderated reports; add login, database persistence, OCR, routing/maps API, real LLM calls, moderation, and privacy safeguards.
