import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isoDate, mondayOf, DAY_NAMES, shiftTimeLabel, SHIFT_TYPE_LABEL } from '../lib/dates.js';
import Badge from '../components/Badge.jsx';

const SHIFT_LABELS = SHIFT_TYPE_LABEL;

// ─── Admin view ───────────────────────────────────────────────────────────────
function AdminAvailability() {
  const [weekStart, setWeekStart] = useState(isoDate(mondayOf()));
  const [grid, setGrid] = useState({});
  const [employees, setEmployees] = useState([]);
  const [busyId, setBusyId] = useState(null);

  function shiftWeek(delta) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(isoDate(d));
  }

  useEffect(() => {
    api.get('/api/employees').then(setEmployees);
  }, []);

  function load() {
    if (!employees.length) return;
    api.get(`/api/availability/all?week_start=${weekStart}`).then(({ rows }) => {
      const map = {};
      for (const emp of employees) {
        map[emp.id] = { full_name: emp.full_name, days: {} };
      }
      for (const r of rows || []) {
        if (!map[r.emp_id]) map[r.emp_id] = { full_name: r.full_name, days: {} };
        map[r.emp_id].days[r.day_of_week] = r;
      }
      setGrid(map);
    });
  }

  useEffect(load, [weekStart, employees]);

  async function decide(row, status) {
    setBusyId(row.id);
    try {
      await api.patch(`/api/availability/${row.id}/status`, { status });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const weekDates = DAY_NAMES.map((_, i) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  });

  const empList = employees.filter((e) => e.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">Staff availability</h1>
          <p className="section-sub">Review submitted availability and approve shifts onto the schedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => shiftWeek(-1)}>← Prev</button>
          <input type="date" className="input" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          <button className="btn-ghost" onClick={() => shiftWeek(1)}>Next →</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-clay/10">
              <th className="py-3 px-3 text-clay/60 font-medium min-w-[140px]">Employee</th>
              {DAY_NAMES.map((name, i) => (
                <th key={i} className="py-3 px-3 text-clay/60 font-medium text-center min-w-[130px]">
                  <div>{name}</div>
                  <div className="text-xs font-normal text-clay/40">{weekDates[i]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empList.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-clay/60">No active employees.</td></tr>
            )}
            {empList.map((emp) => {
              const empData = grid[emp.id] || { days: {} };
              return (
                <tr key={emp.id} className="border-b border-clay/5 last:border-0">
                  <td className="py-3 px-3 font-semibold text-clay align-top">{emp.full_name}</td>
                  {DAY_NAMES.map((_, i) => {
                    const day = empData.days[i];
                    if (!day) {
                      return (
                        <td key={i} className="py-3 px-3 text-center align-top">
                          <span className="text-clay/30 text-xs italic">Not set</span>
                        </td>
                      );
                    }
                    const avail = day.available === true || day.available === 1;
                    return (
                      <td key={i} className="py-3 px-3 text-center align-top">
                        {avail ? (
                          <div className="space-y-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green text-xs font-semibold">
                              {SHIFT_LABELS[day.shift_type] || 'Available'}
                            </span>
                            <div className="text-clay/60 text-xs">{shiftTimeLabel(day.shift_type, DAY_NAMES[i])}</div>
                            {day.notes && <div className="text-clay/40 text-xs italic">{day.notes}</div>}
                            <div><Badge status={day.status} /></div>
                            {day.status === 'pending' && (
                              <div className="flex items-center justify-center gap-1.5 pt-1">
                                <button
                                  disabled={busyId === day.id}
                                  onClick={() => decide(day, 'approved')}
                                  className="text-xs px-2 py-1 rounded-full bg-accent-green/15 text-accent-green font-semibold hover:bg-accent-green/25 disabled:opacity-50"
                                >Approve</button>
                                <button
                                  disabled={busyId === day.id}
                                  onClick={() => decide(day, 'rejected')}
                                  className="text-xs px-2 py-1 rounded-full bg-accent-red/15 text-accent-red font-semibold hover:bg-accent-red/25 disabled:opacity-50"
                                >Reject</button>
                              </div>
                            )}
                            {day.status === 'approved' && (
                              <button
                                disabled={busyId === day.id}
                                onClick={() => decide(day, 'rejected')}
                                className="text-xs px-2 py-1 rounded-full border border-clay/20 text-clay/60 hover:border-clay/50 disabled:opacity-50"
                              >Revoke</button>
                            )}
                            {day.status === 'rejected' && (
                              <button
                                disabled={busyId === day.id}
                                onClick={() => decide(day, 'approved')}
                                className="text-xs px-2 py-1 rounded-full border border-clay/20 text-clay/60 hover:border-clay/50 disabled:opacity-50"
                              >Approve anyway</button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-accent-red/15 text-accent-red text-xs font-semibold">✗ Off</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Employee view ────────────────────────────────────────────────────────────
const SHIFT_OPTIONS = [
  { value: null, label: 'Off' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'both', label: 'Both' },
];

function emptyDays() {
  return DAY_NAMES.map((_, i) => ({ day_of_week: i, shift_type: null, notes: '', status: null }));
}

function EmployeeAvailability() {
  const [weekStart, setWeekStart] = useState(isoDate(mondayOf()));
  const [days, setDays] = useState(emptyDays);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/api/availability/me?week_start=${weekStart}`).then((res) => {
      if (res.days && res.days.length) {
        const next = DAY_NAMES.map((_, i) => {
          const row = res.days.find((d) => d.day_of_week === i);
          return row
            ? { day_of_week: i, shift_type: row.available ? row.shift_type : null, notes: row.notes || '', status: row.status }
            : { day_of_week: i, shift_type: null, notes: '', status: null };
        });
        setDays(next);
      } else {
        setDays(emptyDays());
      }
    });
  }, [weekStart]);

  function update(i, patch) {
    setDays((d) => d.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  async function save() {
    setSaved(false);
    await api.post('/api/availability', {
      week_start: weekStart,
      days: days.map(({ day_of_week, shift_type, notes }) => ({ day_of_week, shift_type, notes })),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Refresh so any status reset (e.g. from a changed selection) shows immediately.
    api.get(`/api/availability/me?week_start=${weekStart}`).then((res) => {
      if (res.days && res.days.length) {
        setDays(DAY_NAMES.map((_, i) => {
          const row = res.days.find((d) => d.day_of_week === i);
          return row
            ? { day_of_week: i, shift_type: row.available ? row.shift_type : null, notes: row.notes || '', status: row.status }
            : { day_of_week: i, shift_type: null, notes: '', status: null };
        }));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="section-title">My availability</h1>
        <p className="section-sub">Pick lunch, dinner, or both for each day the manager can schedule you. Times are set automatically.</p>
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

              <div className="col-span-9 sm:col-span-4 flex flex-wrap gap-1.5">
                {SHIFT_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => update(i, { shift_type: opt.value })}
                    className={`text-xs px-3 py-1.5 rounded-full border transition
                      ${row.shift_type === opt.value
                        ? 'bg-clay text-cream border-clay'
                        : 'border-clay/20 text-clay/60 hover:border-clay/50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="col-span-6 sm:col-span-3 text-xs text-clay/50">
                {row.shift_type ? shiftTimeLabel(row.shift_type, DAY_NAMES[i]) : '—'}
              </div>

              <input
                className="input col-span-6 sm:col-span-2 disabled:opacity-50"
                placeholder="Notes" disabled={!row.shift_type}
                value={row.notes || ''} onChange={(e) => update(i, { notes: e.target.value })}
              />

              <div className="col-span-12 sm:col-span-1 flex justify-end">
                {row.status && <Badge status={row.status} />}
              </div>
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

// ─── Root export ──────────────────────────────────────────────────────────────
export default function Availability() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminAvailability /> : <EmployeeAvailability />;
}
