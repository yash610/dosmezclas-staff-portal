import { useEffect, useState } from 'react';
import { api } from '../api.js';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import { mondayOf, isoDate, addDays, hoursBetween, fmtTime } from '../lib/dates.js';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [week, setWeek] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ws = isoDate(mondayOf());
    Promise.all([
      api.get(`/api/schedules?week=${ws}`),
      api.get('/api/employees'),
      api.get('/api/requests?status=pending'),
    ]).then(([w, emps, reqs]) => {
      setWeek(w); setEmployees(emps); setRequests(reqs);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-cream/70">Loading…</div>;

  const totalHours = (week?.shifts || []).reduce((acc, s) => acc + hoursBetween(s.start_time, s.end_time, s.break_minutes), 0);
  const today = isoDate(new Date());
  const todayShifts = (week?.shifts || []).filter((s) => s.shift_date === today);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-title">Buenos días, jefe 🌶️</h1>
        <p className="section-sub">Here's what's cooking this week at Dos Mezclas.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active staff"   value={employees.length} icon="👥" accent="green" />
        <StatCard label="Shifts this week" value={(week?.shifts || []).length} icon="🗓️" accent="orange" />
        <StatCard label="Hours scheduled" value={totalHours.toFixed(1)} hint="this week" icon="⏱️" accent="yellow" />
        <StatCard label="Pending requests" value={requests.length} icon="🔁" accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-clay">Today on the floor</h2>
            <Link to="/schedule" className="text-accent-red font-semibold text-sm hover:underline">Open schedule →</Link>
          </div>
          {todayShifts.length === 0 ? (
            <div className="text-clay/60 py-8 text-center">No shifts scheduled for today.</div>
          ) : (
            <div className="space-y-2">
              {todayShifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-cream-200 rounded-2xl px-4 py-3">
                  <div>
                    <div className="font-semibold text-clay">{s.full_name}</div>
                    <div className="text-clay/60 text-sm">{s.position || s.role_name || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-clay">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                    <Badge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-clay">Pending requests</h2>
            <Link to="/requests" className="text-accent-red font-semibold text-sm hover:underline">All →</Link>
          </div>
          {requests.length === 0 ? (
            <div className="text-clay/60 py-8 text-center">All caught up.</div>
          ) : (
            <ul className="space-y-3">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id} className="bg-cream-200 rounded-2xl px-4 py-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-clay">{r.requester_name}</div>
                      <div className="text-clay/60 text-sm">{r.shift_date} · {fmtTime(r.start_time)}–{fmtTime(r.end_time)}</div>
                    </div>
                    <Badge status={r.type} />
                  </div>
                  {r.reason && <div className="text-clay/70 text-xs mt-2 italic">"{r.reason}"</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
