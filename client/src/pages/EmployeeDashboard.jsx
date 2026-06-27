import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import { Link } from 'react-router-dom';
import { mondayOf, isoDate, fmtTime, hoursBetween } from '../lib/dates.js';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [week, setWeek] = useState(null);

  useEffect(() => {
    api.get('/api/schedules/me/today').then(setToday);
    api.get(`/api/schedules/me/week?week=${isoDate(mondayOf())}`).then(setWeek);
  }, []);

  const weekHours = (week?.shifts || []).reduce((a, s) => a + hoursBetween(s.start_time, s.end_time, s.break_minutes), 0);
  const upcoming = (week?.shifts || []).filter((s) => s.shift_date >= isoDate());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Hola, {(user?.fullName || 'team').split(' ')[0]} 👋</h1>
        <p className="section-sub">Welcome back to the Dos Mezclas staff portal.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Today" value={today?.shifts?.length ? today.shifts.length : 'Off'} hint={today?.shifts?.length ? 'shift(s)' : 'enjoy the day'} icon="🌶️" accent="orange" />
        <StatCard label="This week" value={weekHours.toFixed(1)} hint="hours scheduled" icon="⏱️" accent="yellow" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-clay">Today's shift</h2>
          <Link to="/schedule" className="text-accent-red font-semibold text-sm hover:underline">See week →</Link>
        </div>
        {!today?.shifts?.length ? (
          <div className="text-clay/60 py-8 text-center">
            <div className="text-4xl mb-2">🌴</div>
            You're off today. Enjoy!
          </div>
        ) : (
          <div className="space-y-3">
            {today.shifts.map((s) => (
              <div key={s.id} className="bg-cream-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-display text-2xl text-clay">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                  <div className="text-clay/60 text-sm mt-1">{s.position || 'Floor'} · {s.break_minutes}m break</div>
                </div>
                <Badge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-display text-2xl text-clay mb-4">Upcoming this week</h2>
        {upcoming.length === 0 ? (
          <div className="text-clay/60 py-6 text-center">Nothing else scheduled this week.</div>
        ) : (
          <ul className="divide-y divide-clay/10">
            {upcoming.map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-clay">
                    {new Date(s.shift_date + 'T00:00:00').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}
                  </div>
                  <div className="text-clay/60 text-sm">{s.position || '—'}</div>
                </div>
                <div className="font-semibold text-clay">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/availability" className="btn-secondary">Set availability</Link>
        <Link to="/requests" className="btn-primary">New request</Link>
      </div>
    </div>
  );
}
