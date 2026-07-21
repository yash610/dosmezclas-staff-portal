// Single source of truth for shift start/end times. Employees and admins only
// ever pick a shift TYPE (lunch / dinner / both) — the actual clock times are
// derived here so they can never drift out of sync between availability and
// the schedule.
//
// Lunch is the same every day. Dinner varies by day of week:
//   Mon–Thu : 3:00 PM – 9:00 PM
//   Fri–Sat : 3:00 PM – 10:00 PM
//   Sun     : 3:00 PM – 8:00 PM

const LUNCH = { start_time: '10:00', end_time: '15:00' };

// weekday: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
function dinnerTimes(weekday) {
  if (weekday === 'Sun') return { start_time: '15:00', end_time: '20:00' };
  if (weekday === 'Fri' || weekday === 'Sat') return { start_time: '15:00', end_time: '22:00' };
  return { start_time: '15:00', end_time: '21:00' }; // Mon–Thu
}

const SHIFT_TYPES = ['lunch', 'dinner', 'both'];

// Returns { start_time, end_time } for a given weekday + shift type, or
// { start_time: null, end_time: null } if shiftType isn't one of the three
// valid values (i.e. the employee marked themselves unavailable that day).
function computeShiftTimes(weekday, shiftType) {
  if (shiftType === 'lunch') return { ...LUNCH };
  if (shiftType === 'dinner') return dinnerTimes(weekday);
  if (shiftType === 'both') return { start_time: LUNCH.start_time, end_time: dinnerTimes(weekday).end_time };
  return { start_time: null, end_time: null };
}

// Maps a JS Date.getUTCDay() index (0=Sun..6=Sat) to our weekday label.
const JS_DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayLabelFromIso(iso) {
  return JS_DOW_LABELS[new Date(iso + 'T00:00:00Z').getUTCDay()];
}

// Maps the availability table's day_of_week index (0=Mon..6=Sun, matching
// the client's DAY_NAMES order) to our weekday label.
const AVAILABILITY_DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function weekdayLabelFromAvailabilityIndex(dayOfWeek) {
  return AVAILABILITY_DOW_LABELS[dayOfWeek];
}

module.exports = {
  LUNCH,
  SHIFT_TYPES,
  dinnerTimes,
  computeShiftTimes,
  weekdayLabelFromIso,
  weekdayLabelFromAvailabilityIndex,
};
