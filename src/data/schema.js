import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";

// ---------- Players ----------

export async function getPlayers() {
  const snap = await getDocs(collection(db, "players"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addPlayer({ name, notes = "" }) {
  const ref = await addDoc(collection(db, "players"), { name, notes });
  return ref.id;
}

export async function updatePlayer(playerId, data) {
  await updateDoc(doc(db, "players", playerId), data);
}

export async function deletePlayer(playerId) {
  // Find every event where this player appears in a squad, and scrub them
  // out so deleted players don't linger as "?" in squad displays.
  const allEvents = await getEvents();
  const affectedEvents = [];

  for (const event of allEvents) {
    const squads = event.squads || [];
    const isInSquad = squads.some((s) => s.memberIds?.includes(playerId));
    if (!isInSquad) continue;

    const cleanedSquads = squads.map((s) => ({
      ...s,
      memberIds: s.memberIds.filter((id) => id !== playerId),
    }));
    await updateEvent(event.id, { squads: cleanedSquads });
    affectedEvents.push({
      id: event.id,
      title: event.title,
      status: event.status,
    });
  }

  await deleteDoc(doc(db, "players", playerId));

  return affectedEvents;
}

/**
 * One-time cleanup utility: scans all events for squad memberIds that
 * reference players no longer in the roster (e.g. from before the
 * deletePlayer cleanup logic existed) and strips them out.
 *
 * Returns a list of affected events: { id, title, status, removedNames }
 * Note: removedNames will just be the orphaned IDs since the player docs
 * no longer exist to look up names from.
 */
export async function cleanOrphanedSquadReferences() {
  const [allEvents, allPlayers] = await Promise.all([
    getEvents(),
    getPlayers(),
  ]);
  const validPlayerIds = new Set(allPlayers.map((p) => p.id));
  const affected = [];

  for (const event of allEvents) {
    const squads = event.squads || [];
    let foundOrphan = false;
    const removedIds = [];

    const cleanedSquads = squads.map((s) => {
      const cleanedMemberIds = (s.memberIds || []).filter((id) => {
        const isValid = validPlayerIds.has(id);
        if (!isValid) {
          foundOrphan = true;
          removedIds.push(id);
        }
        return isValid;
      });
      return { ...s, memberIds: cleanedMemberIds };
    });

    if (foundOrphan) {
      await updateEvent(event.id, { squads: cleanedSquads });
      affected.push({
        id: event.id,
        title: event.title,
        status: event.status,
        removedIds,
      });
    }
  }

  return affected;
}

// ---------- Events ----------

export async function getEvents() {
  const q = query(collection(db, "events"), orderBy("startTime", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getEventsForWeek(weekKey) {
  const q = query(
    collection(db, "events"),
    where("weekKey", "==", weekKey),
    orderBy("startTime", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(eventData) {
  // New events go to the end of the manual ordering. Order only needs to
  // be unique-ish and increasing — we don't reuse/compact gaps.
  const existing = await getEvents()
  const maxOrder = existing.reduce((max, e) => Math.max(max, e.order ?? 0), 0)
  const ref = await addDoc(collection(db, "events"), {
    ...eventData,
    status: "active",
    order: maxOrder + 1,
    createdAt: serverTimestamp(),
    endedAt: null,
  });
  return ref.id;
}

/**
 * Persist a new relative order for a set of events after a drag-and-drop
 * reorder. Takes an array of event IDs in their new desired order and
 * assigns sequential order values.
 */
export async function setEventOrder(orderedEventIds) {
  await Promise.all(
    orderedEventIds.map((id, index) => updateEvent(id, { order: index }))
  )
}

export async function updateEvent(eventId, data) {
  await updateDoc(doc(db, "events", eventId), data);
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, "events", eventId));
}

/**
 * Finalize an event: set status, set endedAt, and apply point updates
 * to weekly_stats based on squads and outcome.
 *
 * status: 'success' | 'failed' | 'cancelled'
 *
 * Rules:
 * - cancelled: no point changes
 * - success: support squads +1 contribution each; scoring squad +1 scoreAchieved each
 * - failed: support squads +1 contribution each; scoring squad gets NO scoreAchieved
 */
/**
 * Finalize an event: set status, set endedAt, apply point updates, and
 * optionally apply a trial score to every scoring squad member.
 *
 * status: 'success' | 'failed' | 'cancelled'
 * score: optional number — if provided and status is 'success', this score
 *   is written to trial_scores for every player in the scoring squad,
 *   under the event's trialNumber. Skipped if the event has no
 *   trialNumber or no score is provided.
 */
export async function finalizeEvent(event, status, score = null) {
  await updateEvent(event.id, {
    status,
    endedAt: serverTimestamp(),
  });

  if (status === "cancelled") return;

  const weekKey = event.weekKey;
  const updates = [];

  for (const squad of event.squads || []) {
    for (const playerId of squad.memberIds || []) {
      if (squad.label === "support") {
        updates.push(
          incrementWeeklyStat(weekKey, playerId, "contributionPoints", 1),
        );
      } else if (squad.label === "scoring" && status === "success") {
        updates.push(
          incrementWeeklyStat(weekKey, playerId, "scoreAchieved", 1),
        );
      }
    }
  }

  // Apply the score to every scoring squad member, if provided.
  if (status === "success" && score !== null && event.trialNumber) {
    const scoringSquad = (event.squads || []).find(
      (s) => s.label === "scoring",
    );
    for (const playerId of scoringSquad?.memberIds || []) {
      updates.push(setTrialScore(weekKey, playerId, event.trialNumber, score));
    }
  }

  await Promise.all(updates);
}

// ---------- Weekly Stats ----------

function weeklyStatId(weekKey, playerId) {
  return `${weekKey}_${playerId}`;
}

export async function getWeeklyStats(weekKey) {
  const q = query(
    collection(db, "weekly_stats"),
    where("weekKey", "==", weekKey),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getWeeklyStatForPlayer(weekKey, playerId) {
  const ref = doc(db, "weekly_stats", weeklyStatId(weekKey, playerId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Increment a numeric field (contributionPoints or scoreAchieved) for a
 * player in a given week. Creates the doc if it doesn't exist.
 */
export async function incrementWeeklyStat(weekKey, playerId, field, amount) {
  const ref = doc(db, "weekly_stats", weeklyStatId(weekKey, playerId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const current = snap.data()[field] || 0;
    await updateDoc(ref, { [field]: current + amount });
  } else {
    await setDoc(ref, {
      weekKey,
      playerId,
      contributionPoints: field === "contributionPoints" ? amount : 0,
      scoreAchieved: field === "scoreAchieved" ? amount : 0,
    });
  }
}

/**
 * Directly SET a numeric field (contributionPoints or scoreAchieved) for a
 * player in a given week, overwriting whatever was there. Used for manual
 * admin corrections (e.g. fixing a mistake) rather than event-driven
 * increments. Creates the doc if it doesn't exist.
 */
export async function setWeeklyStatValue(weekKey, playerId, field, value) {
  const ref = doc(db, "weekly_stats", weeklyStatId(weekKey, playerId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, { [field]: value });
  } else {
    await setDoc(ref, {
      weekKey,
      playerId,
      contributionPoints: field === "contributionPoints" ? value : 0,
      scoreAchieved: field === "scoreAchieved" ? value : 0,
    });
  }
}

// ---------- Trial Scores ----------

function trialScoreId(weekKey, playerId, trialNumber) {
  return `${weekKey}_${playerId}_${trialNumber}`;
}

export async function getTrialScoresForWeek(weekKey) {
  const q = query(
    collection(db, "trial_scores"),
    where("weekKey", "==", weekKey),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setTrialScore(weekKey, playerId, trialNumber, score) {
  const ref = doc(
    db,
    "trial_scores",
    trialScoreId(weekKey, playerId, trialNumber),
  );
  await setDoc(ref, {
    weekKey,
    playerId,
    trialNumber,
    score,
    updatedAt: serverTimestamp(),
  });
}

// ---------- Trial Names ----------
// Per-week, per-slot freeform labels (e.g. "Search cars") describing that
// week's 5 trials. Defaults to "Trial N" when no custom name is set.

const DEFAULT_TRIAL_NAMES = {
  1: "Trial 1",
  2: "Trial 2",
  3: "Trial 3",
  4: "Trial 4",
  5: "Trial 5",
};

export async function getTrialNames(weekKey) {
  const snap = await getDoc(doc(db, "trial_names", weekKey));
  const stored = snap.exists() ? snap.data().names || {} : {};
  // Merge stored names over defaults so any un-set slot still shows "Trial N"
  return { ...DEFAULT_TRIAL_NAMES, ...stored };
}

export async function setTrialName(weekKey, trialNumber, name) {
  const ref = doc(db, "trial_names", weekKey);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data().names || {} : {};
  await setDoc(ref, {
    weekKey,
    names: { ...current, [trialNumber]: name },
  });
}

// ---------- Config (admin passphrase, metaforge cache) ----------

export async function getAdminConfig() {
  const snap = await getDoc(doc(db, "config", "admin"));
  return snap.exists() ? snap.data() : null;
}

export async function getMetaforgeCache() {
  const snap = await getDoc(doc(db, "config", "metaforge_cache"));
  return snap.exists() ? snap.data() : null;
}

export async function setMetaforgeCache(data) {
  await setDoc(doc(db, "config", "metaforge_cache"), {
    data,
    fetchedAt: serverTimestamp(),
  });
}

// ---------- Runs ----------
// Lightweight ad-hoc run records for the Run Planner. Separate from the
// formal events collection — these don't appear on the calendar but do
// affect contribution points, scoring turns, and trial scores exactly like
// events do.
//
// Schema:
// {
//   id,
//   weekKey,
//   trialNumber,
//   status: 'active' | 'complete' | 'incomplete' | 'cancelled',
//   scoringMemberIds: string[],
//   supportMemberIds: string[],
//   score: number | null,
//   createdAt: Timestamp,
//   endedAt: Timestamp | null,
// }

export async function getRunsForWeek(weekKey) {
  const q = query(collection(db, "runs"), where("weekKey", "==", weekKey));
  const snap = await getDocs(q);
  const runs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Sort client-side descending by createdAt to avoid needing a composite index
  return runs.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

export async function getActiveRun() {
  const q = query(collection(db, "runs"), where("status", "==", "active"));
  const snap = await getDocs(q);
  return snap.docs.length > 0
    ? { id: snap.docs[0].id, ...snap.docs[0].data() }
    : null;
}

export async function createRun({
  weekKey,
  trialNumber,
  scoringMemberIds,
  supportMemberIds,
}) {
  const ref = await addDoc(collection(db, "runs"), {
    weekKey,
    trialNumber,
    status: "active",
    scoringMemberIds,
    supportMemberIds,
    score: null,
    createdAt: serverTimestamp(),
    endedAt: null,
  });
  return ref.id;
}

export async function updateRun(runId, data) {
  await updateDoc(doc(db, "runs", runId), data);
}

/**
 * Finalize a run: set status + endedAt, apply contribution/scoring-turn
 * points, and optionally write a trial score to every scoring member.
 * Mirrors finalizeEvent logic exactly.
 */
export async function finalizeRun(run, status, score = null) {
  await updateRun(run.id, {
    status,
    endedAt: serverTimestamp(),
    score: score ?? null,
  });

  if (status === "cancelled") return;

  const updates = [];

  for (const playerId of run.supportMemberIds || []) {
    updates.push(
      incrementWeeklyStat(run.weekKey, playerId, "contributionPoints", 1),
    );
  }

  if (status === "complete") {
    for (const playerId of run.scoringMemberIds || []) {
      updates.push(
        incrementWeeklyStat(run.weekKey, playerId, "scoreAchieved", 1),
      );
    }
    if (score !== null && run.trialNumber) {
      for (const playerId of run.scoringMemberIds || []) {
        updates.push(
          setTrialScore(run.weekKey, playerId, run.trialNumber, score),
        );
      }
    }
  }

  await Promise.all(updates);
}

// ---------- Sessions ----------
// A session tracks the scoring rotation for one trial over multiple days.
// One session open at a time. Contains an ordered list of waves, each
// wave being a scoring squad of up to 3 players.
//
// Session schema:
// {
//   id,
//   weekKey,
//   trialNumber,
//   participantIds: string[],   // admin-curated pool for this session
//   waves: [                    // ordered array, index = wave order
//     {
//       id: string,             // client-generated UUID
//       playerIds: string[],    // up to 3 scoring players
//       status: 'pending' | 'active' | 'complete' | 'cancelled',
//       score: number | null,
//       completedAt: string | null,
//     }
//   ],
//   status: 'open' | 'closed',
//   createdAt: Timestamp,
// }

export async function getActiveSession() {
  const q = query(collection(db, "sessions"), where("status", "==", "open"));
  const snap = await getDocs(q);
  return snap.docs.length > 0
    ? { id: snap.docs[0].id, ...snap.docs[0].data() }
    : null;
}

export async function getSessionsForWeek(weekKey) {
  const q = query(collection(db, "sessions"), where("weekKey", "==", weekKey));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
    );
}

export async function createSession({ weekKey, trialNumber }) {
  const ref = await addDoc(collection(db, "sessions"), {
    weekKey,
    trialNumber,
    runs: [],
    status: "open",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSession(sessionId, data) {
  await updateDoc(doc(db, "sessions", sessionId), data);
}

/**
 * Complete a run in a session: mark it complete and activate the next
 * pending run. Sessions are planning-only — no points or scores are
 * applied here. Use the event system or run planner for official credit.
 */
export async function completeWave(session, runIndex) {
  const runs = session.runs.map((w, i) => {
    if (i === runIndex)
      return {
        ...w,
        status: "complete",
        completedAt: new Date().toISOString(),
      };
    if (i === runIndex + 1 && w.status === "pending")
      return { ...w, status: "active" };
    return w;
  });
  await updateSession(session.id, { runs });
}

/**
 * Cancel a run in a session: mark it cancelled and activate the next
 * pending run. No points applied.
 */
export async function cancelWave(session, runIndex) {
  const runs = session.runs.map((w, i) => {
    if (i === runIndex) return { ...w, status: "cancelled" };
    if (i === runIndex + 1 && w.status === "pending")
      return { ...w, status: "active" };
    return w;
  });
  await updateSession(session.id, { runs });
}

// ---------- Backup / Restore ----------

const BACKUP_COLLECTIONS = [
  "players",
  "events",
  "weekly_stats",
  "trial_scores",
  "trial_names",
  "sessions",
];

/**
 * Export a full snapshot of all collections as a plain JSON object.
 * config/metaforge_cache is excluded (ephemeral schedule cache).
 */
export async function exportSnapshot() {
  const snapshot = {};

  for (const col of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, col));
    snapshot[col] = snap.docs
      .filter((d) => d.id !== "metaforge_cache")
      .map((d) => ({ _id: d.id, ...convertTimestamps(d.data()) }));
  }

  return snapshot;
}

/**
 * Recursively convert Firestore Timestamps to ISO strings so they
 * survive JSON.stringify without being silently dropped or throwing.
 */
function convertTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj?.toDate && typeof obj.toDate === "function")
    return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertTimestamps(v)]),
    );
  }
  return obj;
}

/**
 * Import a full snapshot, overwriting all existing documents.
 * Each document is restored with its original ID using setDoc.
 * Collections not present in the snapshot are left untouched.
 */
export async function importSnapshot(snapshot) {
  for (const [col, docs] of Object.entries(snapshot)) {
    if (!BACKUP_COLLECTIONS.includes(col)) continue;
    for (const docData of docs) {
      const { _id, ...data } = docData;
      if (!_id) continue;
      // Convert any ISO date strings back to plain objects (Firestore handles serialization)
      await setDoc(doc(db, col, _id), data);
    }
  }
}


// ---------- Squad Role Pool ----------
// Per-trial pool of role entries: { role: string, color: number }
// Stored in config/squad_role_pool as { "1": [...], "2": [...], ... }
// Color index is assigned once on first save and never changes,
// so roles keep their color permanently across all events for that trial.

export async function getRolePool(trialNumber) {
  const snap = await getDoc(doc(db, 'config', 'squad_role_pool'))
  if (!snap.exists()) return []
  return snap.data()[String(trialNumber)] || []
}

export async function addRoleToPool(trialNumber, role) {
  const trimmed = role?.trim()
  if (!trimmed) return
  const ref = doc(db, 'config', 'squad_role_pool')
  const snap = await getDoc(ref)
  const current = snap.exists() ? snap.data() : {}
  const pool = current[String(trialNumber)] || []
  if (pool.some(e => e.role === trimmed)) return // already exists, color preserved
  const nextColor = Math.min(pool.length, 9) // cap at last palette index
  const updated = [...pool, { role: trimmed, color: nextColor }]
  await setDoc(ref, { ...current, [String(trialNumber)]: updated })
}

export async function deleteRoleFromPool(trialNumber, role) {
  const ref = doc(db, 'config', 'squad_role_pool')
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = snap.data()
  const pool = current[String(trialNumber)] || []
  const updated = pool.filter(e => e.role !== role)
  await setDoc(ref, { ...current, [String(trialNumber)]: updated })

  // Clear this role from any squad assignments on matching events
  const allEvents = await getEvents()
  for (const event of allEvents) {
    if (event.trialNumber !== trialNumber) continue
    const squads = event.squads || []
    if (!squads.some(s => s.role === role)) continue
    const cleaned = squads.map(s => s.role === role ? { ...s, role: null } : s)
    await updateEvent(event.id, { squads: cleaned })
  }
}
