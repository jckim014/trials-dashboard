# Trials Dashboard

Admin dashboard for coordinating Arc Raiders weekly Trials events with a community.

## Stack
- React (Vite)
- Firebase (Firestore for data, Auth not used — passphrase-based admin gate)
- Hosted on GitHub Pages

## Project Structure

```
src/
  components/
    calendar/         # Public event calendar views
    admin/             # Admin-only panels (event creation, squad mgmt, scoring)
    stats/             # Leaderboard / contribution / trial score views
    shared/            # Shared UI (modals, buttons, player cards)
  data/
    firebase.js        # Firebase init/config
    schema.js          # Firestore collection helpers (CRUD wrappers)
    metaforge.js        # Metaforge API integration (event schedule fetch + cache)
  context/
    AdminContext.jsx   # Admin auth state (passphrase check result)
  utils/
    weeks.js           # Week-key calculation (Mon-Sun PST)
    points.js          # Contribution / score-achieved calculation logic
    suggestions.js      # Candidate suggestion algorithm for scoring squad
  App.jsx
  main.jsx
public/
  index.html
```

## Firestore Collections (draft schema)

### `players`
```
{
  id: string,
  name: string,
  notes: string
}
```

### `events`
```
{
  id: string,
  title: string,
  description: string,
  map: string,            // e.g. "Dam", "Spaceport"
  condition: string,      // e.g. "Night Raid"
  startTime: Timestamp,   // from Metaforge schedule, UTC
  endTime: Timestamp,
  status: "active" | "success" | "failed" | "cancelled",
  weekKey: string,         // e.g. "2026-06-08" (Monday anchor date)
  squads: [
    {
      label: "scoring" | "support",
      memberIds: string[]  // up to 3 player ids
    }
  ],
  createdAt: Timestamp,
  endedAt: Timestamp | null
}
```

### `weekly_stats`
Doc ID: `${weekKey}_${playerId}`
```
{
  weekKey: string,
  playerId: string,
  contributionPoints: number,   // +1 per support round this week
  scoreAchieved: number          // +1 per successful scoring round this week
}
```

### `trial_scores`
Doc ID: `${weekKey}_${playerId}_${trialNumber}`
```
{
  weekKey: string,
  playerId: string,
  trialNumber: 1 | 2 | 3 | 4 | 5,
  score: number,
  updatedAt: Timestamp
}
```

### `config`
Doc ID: `admin`
```
{
  passwordHash: string   // SHA-256 hex digest, set manually via Firebase console
}
```

Doc ID: `metaforge_cache`
```
{
  data: object,          // raw or normalized event-schedule response
  fetchedAt: Timestamp
}
```

## Week Key Convention
- Weeks run Monday 00:00 to Sunday 23:59:59 PST (reset at Sun/Mon midnight PST).
- `weekKey` = the Monday date of that week, formatted `YYYY-MM-DD`, computed in PST regardless of viewer's local timezone.

## Setup (TODO once scaffolding is reviewed)
1. Create Firebase project, enable Firestore
2. Add Firebase config to `src/data/firebase.js`
3. Manually create `config/admin` doc with passphrase hash (see `utils/hash.js` for hashing helper)
4. Set Firestore security rules (see `firestore.rules`)
5. `npm install && npm run dev`
6. Deploy to GitHub Pages via `npm run build` + gh-pages branch
