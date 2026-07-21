import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { addDays, isoDate, mondayOf, weekDays, hoursBetween, shiftTimeLabel, SHIFT_TYPE_LABEL } from '../lib/dates.js';
import Modal from '../components/Modal.jsx';
import { POSITIONS } from '../lib/positions.js';

const SHIFT_TYPES = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'both', label: 'Both' },
];

const blankShift = {
  employee_id: '', shift_date: '', shift_type: 'dinner',
  break_hours: 0, break_mins: 30, position: '', notes: '',
};

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [weekStart, setWeekStart] = useState(isoDate(mondayOf()));
  const [data, setData] = useState({ shifts: [] });
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null); // shift object | 'new' | null
  const [form, setForm] = useState(blankShift);
  const [shiftErr, setShiftErr] = useState('');
  const [busyId, setBusyId] = useState(null);

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
    setEditing('new'); setShiftErr('');
  }
  function startEdit(s) {
    const bm = s.break_minutes || 0;
    setForm({
      employee_id: s.employee_id, shift_date: s.shift_date,
      shift_type: s.shift_type || 'dinner',
      break_hours: Math.floor(bm / 60), break_mins: bm % 60,
      position: s.position || '', notes: s.notes || '',
    });
    setEditing(s); setShiftErr('');
  }
  async function save() {
    setShiftErr('');
    if (form.break_mins > 59) { setShiftErr('Break minutes cannot exceed 59.'); return; }
    if (form.break_hours > 12) { setShiftErr('Break hours cannot exceed 12.'); return; }
    if (!form.employee_id || !form.shift_date || !form.shift_type) { setShiftErr('Employee, date, and shift type are required.'); return; }
    const payload = { ...form, break_minutes: form.break_hours * 60 + form.break_mins };
    delete payload.break_hours; delete payload.break_mins;
    if (editing === 'new') {
      await api.post('/api/schedules', payload);
    } else {
      await api.patch(`/api/schedules/${editing.id}`, payload);
    }
    setEditing(null); load();
  }
  async function remove() {
    if (!confirm('Delete this shift?')) return;
    await api.del(`/api/schedules/${editing.id}`);
    setEditing(null); load();
  }

  async function respond(shiftId, decision) {
    setBusyId(shiftId);
    try {
      await api.patch(`/api/schedules/${shiftId}/employee-approval`, { decision });
      load();
    } finally {
      setBusyId(null);
    }
  }

  function dayLabelFor(iso) {
    const d = days.find((x) => x.iso === iso);
    return d ? d.label : '';
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
              {(grouped[d.iso] || []).map((s) => {
                const pending = s.employee_approval === 'pending';
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl transition ${pending ? 'border-2 border-dashed border-accent-orange/60 bg-cream/60' : 'bg-cream shadow-warm'}`}
                  >
                    <button
                      onClick={() => isAdmin && startEdit(s)}
                      className={`block w-full text-left p-3 ${isAdmin ? 'hover:scale-[1.01]' : 'cursor-default'} ${pending ? 'text-clay/60' : 'text-clay'}`}
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
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-clay/10 text-clay/70 font-semibold">
                          {SHIFT_TYPE_LABEL[s.shift_type] || 'Shift'}
                        </span>
                        <span className="text-xs font-semibold">{shiftTimeLabel(s.shift_type, d.label) || `${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)}`}</span>
                      </div>
                    </button>
                    {pending && (
                      <div className="px-3 pb-3">
                        {isAdmin ? (
                          <div className="border-t border-clay/10 pt-2">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-accent-orange text-white text-[10px] font-bold uppercase tracking-wide">
                              Awaiting employee approval
                            </span>
                          </div>
                        ) : (
                          <div className="border-t border-clay/10 pt-2 space-y-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-accent-orange text-white text-[10px] font-bold uppercase tracking-wide">
                              Needs your approval
                            </span>
                            <div className="text-xs text-clay font-medium">Manager assigned you this shift on a day you're off.</div>
                            <div className="flex gap-1.5">
                              <button
                                disabled={busyId === s.id}
                                onClick={() => respond(s.id, 'approved')}
                                className="text-xs px-2 py-1 rounded-full bg-accent-green/15 text-accent-green font-semibold hover:bg-accent-green/25 disabled:opacity-50"
                              >Approve</button>
                              <button
                                disabled={busyId === s.id}
                                onClick={() => respond(s.id, 'rejected')}
                                className="text-xs px-2 py-1 rounded-full bg-accent-red/15 text-accent-red font-semibold hover:bg-accent-red/25 disabled:opacity-50"
                              >Reject</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
        {shiftErr && <div className="text-accent-red text-sm mb-3">{shiftErr}</div>}
        {editing && editing !== 'new' && editing.employee_approval === 'pending' && (
          <div className="text-xs text-clay font-medium bg-accent-orange/15 border border-accent-orange/40 rounded-xl px-3 py-2 mb-3">
            This shift is still awaiting the employee's approval — they marked themselves off that day.
          </div>
        )}
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
            <select className="input" value={form.position} onChange={(e) => setForm({...form, position: e.target.value})}>
              <option value="">— Select position —</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-clay/70 text-sm font-medium block mb-1">Shift</label>
            <div className="flex flex-wrap gap-1.5">
              {SHIFT_TYPES.map((t) => (
                <button
                  key={t.value} type="button"
                  onClick={() => setForm({ ...form, shift_type: t.value })}
                  className={`text-xs px-3 py-1.5 rounded-full border transition
                    ${form.shift_type === t.value ? 'bg-clay text-cream border-clay' : 'border-clay/20 text-clay/60 hover:border-clay/50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {form.shift_date && form.shift_type && (
              <div className="text-clay/50 text-xs mt-1.5">
                {shiftTimeLabel(form.shift_type, dayLabelFor(form.shift_date) || new Date(form.shift_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }))}
              </div>
            )}
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Break hours (max 12)</label>
            <input type="number" min="0" max="12" className="input" value={form.break_hours}
              onChange={(e) => setForm({...form, break_hours: Math.max(0, Math.min(12, Number(e.target.value)))})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Break minutes (max 59)</label>
            <input type="number" min="0" max="59" className="input" value={form.break_mins}
              onChange={(e) => setForm({...form, break_mins: Math.max(0, Math.min(59, Number(e.target.value)))})} />
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
