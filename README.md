# MedClock — Medication Reminder & Linked Alarm PWA

**Live App:** [https://jee1vk.github.io/med-alarm-app/](https://jee1vk.github.io/med-alarm-app/)

MedClock is an installable, offline-capable Progressive Web App (PWA) for scheduling daily medication alarms, tracking pill stock & expiry dates, and celebrating daily adherence streaks.

---

## Key Features
- **Linked Medication Alarms:** Configure fixed daily times (with 1-tap presets: `1× Morning`, `2× Day & Night`, `3× Meals`, `Bedtime`), **Every X Hours** intervals (`4h`, `6h`, `8h`, `12h`), or **As Needed (PRN)** doses.
- **Persistent Web Audio Synthesizer:** Zero-dependency Web Audio API engine (`Temple Chime`, `Classic Bell`, `Urgent Pulse`, `Gentle Dawn`) + device vibration + 2-note victory chime on dose completion.
- **Reliable Catch-Up & Snooze:** 2-minute catch-up window + `visibilitychange` / `focus` checks prevent missed alarms in throttled tabs, and snoozed alarms automatically cancel if the dose is logged early.
- **Tablet & Prescription Photo Vault:** Attach compressed **Tablet** and **Prescription** reference photos to any medicine (stored offline in IndexedDB). Tablet photos appear right inside the ringing alarm screen and open in a full-screen lightbox from Medicine cards.
- **Pill Stock & Expiry Alerts:** Automatic low-stock refill warnings (`+30` quick refill) and 14-day medicine expiration alerts.
- **Streaks, Completion Ring & Badges:** SVG daily completion ring, active day-streak counter, milestone badges (*First Step*, *3-Day Starter*, *7-Day Rhythm*, *30-Dose Champion*), and 100% daily confetti burst.
- **Daylight & Bedside Night Mode:** High-contrast Calm Clinical Sky (`#0369A1`) & Health Emerald (`#047857`) daylight theme paired with a low-glare `#0B1120` Bedside Night Mode.
- **Doctor-Ready CSV & JSON Backup:** Export dose history to CSV or download/restore full JSON backups offline.

---

## Local Development

```powershell
pushd "\\KUBERAN-NAS\Kuberan\Jeevan\Gemini Projects\med-alarm-app"
npm install
npm run dev
```

### Build & Lint Verification

```powershell
npm run lint
npm run build
```
