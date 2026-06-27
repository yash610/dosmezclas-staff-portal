import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { addDays, isoDate, mondayOf, weekDays, fmtTime, hoursBetween } from '../lib/dates.js';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';

const blankShift = {
  employee_id: '', shift_date: '', start_time: '17:00', end_time: '22:00',
  break_minutes: 30, position: '', notes: '',
};

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [weekStart, setWeekStart] = useState(isoDate(mondayOf()));
  const [data, setData] = useState({ shifts: [] });
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null); // shift object | 'new' | null
  const [form, setForm] = useState(blankShift);

  function load() {
    api.get(`/api/schedules?week=${weekStart}`).then(setData);
  }
  useEffect(() => { load(); }, [weekStart]);
  useEffect(() => { if (isAdmin) api.get('/api/employees').then(setEmployees); }, [isAdmin]);

  const days = weekDays(weekStart);
  const grouped = useMemo(() => {
    const map = {};
    for (const d of days) map[d.iso] = [];
    for (const s of data.shifts || []) (map[s.shift_date] = map[s.shift_date] || []).push(s);
    return map;
  }, [data, weekStart]);

  function shiftWeek(delta) {
    setWeekStart(isoDate(addDays(new Date(weekStart + 'T00:00:00'), delta * 7)));
  }

  function startNew(dateIso) {
    setForm({ ...blankShift, shift_date: dateIso || days[0].iso, employee_id: employees[0]?.id || '' });
    setEditing('new');
  }
  function startEdit(s) {
    setForm({
      employee_id: s.employee_id, shift_date: s.shift_date,
      start_time: s.start_time, end_time: s.end_time,
      break_minutes: s.break_minutes || 0,
      position: s.position || '', notes: s.notes || '',
    });
    setEditing(s);
  }
  async function save() {
    if (editing === 'new') {
      await api.post('/api/schedules', form);
    } else {
      await api.patch(`/api/schedules/${editing.id}`, form);
    }
    setEditing(null); load();
  }
  async function remove() {
    if (!confirm('Delete this shift?')) return;
    await api.del(`/api/schedules/${editing.id}`);
    setEditing(null); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">{isAdmin ? 'Weekly schedule' : 'My week'}</h1>
          <p className="section-sub">Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => shiftWeek(-1)}>← Prev</button>
          <button className="btn-ghost" onClick={() => setWeekStart(isoDate(mondayOf()))}>Today</button>
          <button className="btn-ghost" onClick={() => shiftWeek(1)}>Next →</button>
          {isAdmin && <button className="btn-primary" onClick={() => startNew()}>+ Add shift</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((d) => (
          <div key={d.iso} className="card-dark">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <div className="text-cream/60 text-xs uppercase tracking-wider">{d.label}</div>
                <div className="font-display text-2xl text-cream">{d.day}</div>
              </div>
              <div className="text-cream/40 text-xs">{d.month}</div>
            </div>
            <div className="space-y-2">
              {(grouped[d.iso] || []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => isAdmin && startEdit(s)}
                  className={`block w-full text-left rounded-2xl p-3 transition
                    ${isAdmin ? 'hover:scale-[1.01]' : 'cursor-default'}
                    bg-cream text-clay shadow-warm`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-sm">{s.full_name}</div>
                      <div className="text-clay/60 text-xs">{s.position || s.role_name || '—'}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-orange/20 text-accent-orange font-semibold whitespace-nowrap">
                      {hoursBetween(s.start_time, s.end_time, s.break_minutes).toFixed(1)}h
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => startNew(d.iso)}
                  className="w-full rounded-2xl py-2 text-cream/40 hover:text-cream hover:bg-white/5 text-xs"
                >+ Add</button>
              )}
              {!(grouped[d.iso] || []).length && !isAdmin && (
                <div className="text-cream/40 text-xs italic">No shift</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New shift' : 'Edit shift'}
        footer={<>
          {editing && editing !== 'new' && (
            <button className="btn-danger mr-auto" onClick={remove}>Delete</button>
          )}
          <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-clay/70 text-sm font-medium block mb-1">Employee</label>
            <select className="input" value={form.employee_id || ''} onChange={(e) => setForm({...form, employee_id: Number(e.target.value)})}>
              <option value="">— Select —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.role_name || 'staff'})</option>)}
            </select>
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Date</label>
            <input type="date" className="input" value={form.shift_date} onChange={(e) => setForm({...form, shift_date: e.target.value})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Position</label>
            <input className="input" placeholder="Floor — Dinner" value={form.position} onChange={(e) => setForm({...form, position: e.target.value})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Start</label>
            <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">End</label>
            <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Break (min)</label>
            <input type="number" min="0" className="input" value={form.break_minutes} onChange={(e) => setForm({...form, break_minutes: Number(e.target.value)})} />
          </div>
          <div className="col-span-2">
            <label className="text-clay/70 text-sm font-medium block mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
