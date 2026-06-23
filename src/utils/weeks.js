// Week runs Monday 00:00 PST to Sunday 23:59:59 PST.
// weekKey = the Monday date of that week, formatted YYYY-MM-DD, in PST.

const PST_TIMEZONE = 'America/Los_Angeles'

/**
 * Get the current date/time as a Date object representing PST wall-clock time.
 * (Returns a Date whose UTC fields equal the PST wall-clock fields, so
 * getDay/getDate/etc reflect PST regardless of the runtime's local timezone.)
 */
function nowInPST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const map = {}
  for (const { type, value } of parts) map[type] = value

  // Construct a UTC Date using PST wall-clock numbers
  return new Date(Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  ))
}

/**
 * Returns the weekKey (Monday date, YYYY-MM-DD) for the given date,
 * based on PST wall-clock time. Defaults to now.
 */
export function getWeekKey(date = new Date()) {
  const pst = nowInPST(date)
  const day = pst.getUTCDay() // 0 = Sunday, 1 = Monday, ... 6 = Saturday

  // Days to subtract to get back to Monday
  const daysSinceMonday = (day + 6) % 7
  const monday = new Date(pst)
  monday.setUTCDate(pst.getUTCDate() - daysSinceMonday)

  const yyyy = monday.getUTCFullYear()
  const mm = String(monday.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(monday.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns a human-readable label for a weekKey, e.g. "Week of Jun 8, 2026"
 */
export function formatWeekLabel(weekKey) {
  const [y, m, d] = weekKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const label = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `Week of ${label}`
}

/**
 * Given an event's start time (Date or Firestore Timestamp), compute its weekKey.
 */
export function weekKeyForEventTime(startTime) {
  const date = startTime?.toDate ? startTime.toDate() : new Date(startTime)
  return getWeekKey(date)
}
