import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import { addDays, isoDate, fmtTime } from '../lib/dates.js';

function startOfMonth() {
  const d = new Date(); d.setDate(1); return isoDate(d);
}

const PRESETS = [
  { key: 'week',  label: 'This week',  from: () => isoDate(addDays(new Date(), -((new Date().getDay() || 7) - 1))), to: () => isoDate() },
  { key: 'month', label: 'This month', from: () => startOfMonth(), to: () => isoDate() },
  { key: '30',    label: 'Last 30 days', from: () => isoDate(addDays(new Date(), -30)), to: () => isoDate() },
  { key: '90',    label: 'Last 90 days', from: () => isoDate(addDays(new Date(), -90)), to: () => isoDate() },
];

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [group, setGroup] = useState('employee');
  const [from, setFrom] = useState(PRESETS[0].from());
  const [to, setTo] = useState(PRESETS[0].to());
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [summary, setSummary] = useState({ rows: [] });
  const [drill, setDrill] = useState({ rows: [] });

  useEffect(() => { if (isAdmin) api.get('/api/employees').then(setEmployees); }, [isAdmin]);

  useEffect(() => {
    const qs = new URLSearchParams({ group, from, to });
    if (isAdmin && employeeId) qs.set('employeeId', employeeId);
    api.get(`/api/reports/hours?${qs}`).then(setSummary);
    const qs2 = new URLSearchParams({ from, to });
    if (isAdmin && employeeId) qs2.set('employeeId', employeeId);
    api.get(`/api/reports/drilldown?${qs2}`).then(setDrill);
  }, [group, from, to, employeeId, isAdmin]);

  const totalHours = summary.rows.reduce((a, r) => a + r.hours, 0);
  const totalShifts = summary.rows.reduce((a, r) => a + r.shifts, 0);

  function applyPreset(p) { setFrom(p.from()); setTo(p.to()); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">{isAdmin ? 'Hours & reports' : 'My hours'}</h1>
        <p className="section-sub">Summary and drill-down across any date range.</p>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="text-clay/70 text-sm font-medium block mb-1">Group by</label>
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="employee">Employee</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div>
          <label className="text-clay/70 text-sm font-medium block mb-1">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-clay/70 text-sm font-medium block mb-1">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {isAdmin && (
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Employee</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.key} className="btn-ghost text-xs py-1 px-3" onClick={() => applyPreset(p)}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-dark"><div className="text-cream/60 text-sm">Total hours</div><div className="font-display text-3xl mt-1">{totalHours.toFixed(1)}</div></div>
        <div className="card-dark"><div className="text-cream/60 text-sm">Shifts</div><div className="font-display text-3xl mt-1">{totalShifts}</div></div>
        <div className="card-dark"><div className="text-cream/60 text-sm">Avg / shift</div><div className="font-display text-3xl mt-1">{totalShifts ? (totalHours/totalShifts).toFixed(1) : '—'}</div></div>
        <div className="card-dark"><div className="text-cream/60 text-sm">Range</div><div className="font-display text-base mt-1">{from} → {to}</div></div>
      </div>

      <div className="card">
        <h2 className="font-display text-2xl text-clay mb-3">Summary by {group}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-clay/60 border-b border-clay/10">
                <th className="py-3 px-2">{group === 'employee' ? 'Employee' : 'Period'}</th>
                <th className="py-3 px-2">Shifts</th>
                <th className="py-3 px-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.key} className="border-b border-clay/5 last:border-0">
                  <td className="py-2 px-2 font-semibold text-clay">{r.label}</td>
                  <td className="py-2 px-2 text-clay/80">{r.shifts}</td>
                  <td className="py-2 px-2 text-right font-semibold text-clay">{r.hours.toFixed(2)}</td>
                </tr>
              ))}
              {summary.rows.length === 0 && (
                <tr><td colSpan="3" className="py-10 text-center text-clay/60">No data in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-2xl text-clay mb-3">Drill-down</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-clay/60 border-b border-clay/10">
                <th className="py-3 px-2">Date</th>
                {isAdmin && <th className="py-3 px-2">Employee</th>}
                <th className="py-3 px-2">Start</th>
                <th className="py-3 px-2">End</th>
                <th className="py-3 px-2">Break</th>
                <th className="py-3 px-2">Hours</th>
                <th className="py-3 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {drill.rows.map((r) => (
                <tr key={r.id} className="border-b border-clay/5 last:border-0">
                  <td className="py-2 px-2 font-semibold text-clay">{r.shift_date}</td>
                  {isAdmin && <td className="py-2 px-2 text-clay/80">{r.full_name}</td>}
                  <td className="py-2 px-2 text-clay/80">{fmtTime(r.start_time)}</td>
                  <td className="py-2 px-2 text-clay/80">{fmtTime(r.end_time)}</td>
                  <td className="py-2 px-2 text-clay/80">{r.break_minutes}m</td>
                  <td className="py-2 px-2 font-semibold text-clay">{r.total_hours.toFixed(2)}</td>
                  <td className="py-2 px-2"><Badge status={r.status} /></td>
                </tr>
              ))}
              {drill.rows.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-clay/60">No shifts in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
