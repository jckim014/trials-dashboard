import { getMetaforgeCache, setMetaforgeCache } from './schema.js'

const SCHEDULE_URL = 'https://metaforge.app/api/arc-raiders/events-schedule'

// How long the cache is considered fresh before attempting a refetch.
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Fetch the event schedule from Metaforge, with Firestore caching as a
 * fallback if the live API is down or blocked by CORS.
 *
 * Returns a normalized array: { map, condition, startTime: Date, endTime: Date }[]
 */
export async function getEventSchedule({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = await getMetaforgeCache()
    if (cached?.fetchedAt) {
      const fetchedAtMs = cached.fetchedAt.toMillis
        ? cached.fetchedAt.toMillis()
        : new Date(cached.fetchedAt).getTime()
      if (Date.now() - fetchedAtMs < CACHE_TTL_MS) {
        // Re-hydrate Date objects from cached plain objects
        return (cached.data || []).map(item => ({
          ...item,
          startTime: new Date(item.startTime),
          endTime: new Date(item.endTime),
        }))
      }
    }
  }

  try {
    const res = await fetch(SCHEDULE_URL)
    if (!res.ok) throw new Error(`Metaforge API returned ${res.status}`)
    const json = await res.json()
    const normalized = normalizeScheduleResponse(json)
    // Store as plain objects (Dates don't serialize to Firestore well)
    await setMetaforgeCache(normalized.map(item => ({
      ...item,
      startTime: item.startTime.getTime(),
      endTime: item.endTime ? item.endTime.getTime() : null,
    })))
    return normalized
  } catch (err) {
    console.warn('Metaforge fetch failed, falling back to cache:', err)
    const cached = await getMetaforgeCache()
    if (cached?.data) {
      return cached.data.map(item => ({
        ...item,
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime),
      }))
    }
    return []
  }
}

/**
 * Normalize the raw Metaforge response.
 * Confirmed shape: { data: [{ name, map, icon, startTime, endTime }] }
 * startTime/endTime are unix timestamps in milliseconds.
 */
function normalizeScheduleResponse(json) {
  const items = Array.isArray(json?.data) ? json.data : []
  return items
    .map((item) => {
      if (!item.map || !item.name || !item.startTime) return null
      return {
        map: item.map,
        condition: item.name,
        startTime: new Date(item.startTime),
        endTime: item.endTime ? new Date(item.endTime) : null,
      }
    })
    .filter(Boolean)
}

/**
 * Given the full schedule and a selected map, return the list of
 * conditions available on that map (deduped, sorted).
 */
export function getConditionsForMap(schedule, map) {
  const conditions = schedule
    .filter((item) => item.map === map)
    .map((item) => item.condition)
  return [...new Set(conditions)].sort()
}

/**
 * Given the full schedule and a selected map + condition, return the
 * list of upcoming time windows for that combination, sorted ascending.
 */
export function getTimeWindowsForMapCondition(schedule, map, condition) {
  const now = new Date()
  return schedule
    .filter((item) => item.map === map && item.condition === condition)
    .filter((item) => item.startTime > now)
    .sort((a, b) => a.startTime - b.startTime)
}

// Confirmed from live API response
export const KNOWN_MAPS = [
  'Dam',
  'Spaceport',
  'Buried City',
  'Blue Gate',
  'Stella Montis',
  'Riven Tides',
]

// Confirmed from live API response (conditions are data-driven, this is
// a fallback reference only)
export const KNOWN_CONDITIONS = [
  'Night Raid',
  'Electromagnetic Storm',
  'Cold Snap',
  'Hidden Bunker',
  'Locked Gate',
  'Close Scrutiny',
  'Matriarch',
  'Harvester',
  'Prospecting Probes',
  'Lush Blooms',
  'Launch Tower Loot',
  'Bird City',
  'Hurricane',
  'Beachcombing',
  'Husk Graveyard',
]
