// Date helpers shared by pages.

export function isoDate(d = new Date()) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x.toISOString().slice(0, 10);
}

export function mondayOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function weekDays(weekStartIso) {
  const start = new Date(weekStartIso + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return {
      iso: isoDate(d),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: 'short' }),
    };
  });
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'p' : 'a';
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}:${String(m).padStart(2,'0')}${ampm}` : `${hh}${ampm}`;
}

export function hoursBetween(start, end, breakMin = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  mins -= (breakMin || 0);
  return Math.max(0, mins) / 60;
}

export const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Display-only helpers mirroring server/lib/shiftTimes.js. The backend is
// still the source of truth for the actual stored times — these just let the
// UI show the right window before/without a round trip to the server.
export function dinnerWindowLabel(weekdayAbbr) {
  if (weekdayAbbr === 'Sun') return '3:00p – 8:00p';
  if (weekdayAbbr === 'Fri' || weekdayAbbr === 'Sat') return '3:00p – 10:00p';
  return '3:00p – 9:00p'; // Mon–Thu
}

export function shiftTimeLabel(shiftType, weekdayAbbr) {
  if (shiftType === 'lunch') return '10:00a – 3:00p';
  if (shiftType === 'dinner') return dinnerWindowLabel(weekdayAbbr);
  if (shiftType === 'both') return `10:00a – ${dinnerWindowLabel(weekdayAbbr).split('–')[1].trim()}`;
  return '';
}

export const SHIFT_TYPE_LABEL = { lunch: 'Lunch', dinner: 'Dinner', both: 'Both' };
