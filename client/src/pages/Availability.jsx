import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { addDays, isoDate, mondayOf, DAY_NAMES } from '../lib/dates.js';

function nextMondayIso() {
  const today = new Date();
  const offset = (8 - today.getDay()) % 7 || 7;
  return isoDate(addDays(today, offset));
}

export default function Availability() {
  const [weekStart, setWeekStart] = useState(nextMondayIso());
  const [days, setDays] = useState(() => DAY_NAMES.map((_, i) => ({
    day_of_week: i, available: true, start_time: '11:00', end_time: '22:00', notes: '',
  })));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/api/availability/me?week_start=${weekStart}`).then((res) => {
      if (res.days && res.days.length) {
        const next = DAY_NAMES.map((_, i) => {
          const row = res.days.find((d) => d.day_of_week === i);
          return row
            ? { day_of_week: i, available: !!row.available, start_time: row.start_time || '11:00', end_time: row.end_time || '22:00', notes: row.notes || '' }
            : { day_of_week: i, available: false, start_time: '11:00', end_time: '22:00', notes: '' };
        });
        setDays(next);
      }
    });
  }, [weekStart]);

  function update(i, patch) {
    setDays((d) => d.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  async function save() {
    setSaved(false);
    await api.post('/api/availability', { week_start: weekStart, days });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="section-title">My availability</h1>
        <p className="section-sub">Let the manager know when you can work next week.</p>
      </div>

      <div className="card">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Week starting</label>
            <input type="date" className="input" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </div>
          {saved && <span className="badge-green">Saved ✓</span>}
        </div>

        <div className="space-y-2">
          {days.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center bg-cream-200 rounded-2xl px-3 py-3">
              <div className="col-span-3 sm:col-span-2 font-display text-lg text-clay">{DAY_NAMES[i]}</div>
              <label className="col-span-3 sm:col-span-2 flex items-center gap-2 text-sm text-clay">
                <input type="checkbox" checked={row.available} onChange={(e) => update(i, { available: e.target.checked })} />
                Available
              </label>
              <input
                type="time" className="input col-span-3 sm:col-span-3 disabled:opacity-50"
                disabled={!row.available}
                value={row.start_time} onChange={(e) => update(i, { start_time: e.target.value })}
              />
              <input
                type="time" className="input col-span-3 sm:col-span-3 disabled:opacity-50"
                disabled={!row.available}
                value={row.end_time} onChange={(e) => update(i, { end_time: e.target.value })}
              />
              <input
                className="input col-span-12 sm:col-span-2 disabled:opacity-50"
                placeholder="Notes" disabled={!row.available}
                value={row.notes || ''} onChange={(e) => update(i, { notes: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button className="btn-primary" onClick={save}>Submit availability</button>
        </div>
      </div>
    </div>
  );
}
