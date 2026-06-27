import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import { fmtTime, isoDate, mondayOf } from '../lib/dates.js';

const blankExtra = { type: 'extra', shift_date: '', start_time: '17:00', end_time: '22:00', position: '', reason: '' };

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [creating, setCreating] = useState(null); // null | 'transfer' | 'extra'
  const [form, setForm] = useState(blankExtra);
  const [myShifts, setMyShifts] = useState([]);
  const [err, setErr] = useState('');

  function load() {
    const qs = filter === 'all' ? '' : `?status=${filter}`;
    api.get(`/api/requests${qs}`).then(setItems);
  }
  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    if (!isAdmin) {
      api.get(`/api/schedules/me/week?week=${isoDate(mondayOf())}`).then((d) => setMyShifts(d.shifts || []));
    }
  }, [isAdmin]);

  function startTransfer() { setForm({ type: 'transfer', schedule_id: '', reason: '' }); setCreating('transfer'); setErr(''); }
  function startExtra()    { setForm({ ...blankExtra }); setCreating('extra'); setErr(''); }

  async function submit() {
    setErr('');
    try {
      await api.post('/api/requests', form);
      setCreating(null); load();
    } catch (e) { setErr(e.message); }
  }

  async function decide(id, decision) {
    await api.patch(`/api/requests/${id}/decide`, { decision });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">{isAdmin ? 'Shift requests' : 'My requests'}</h1>
          <p className="section-sub">{isAdmin ? 'Approve or reject staff requests.' : 'Ask for a transfer or pick up an extra shift.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <>
              <button className="btn-secondary" onClick={startTransfer}>Transfer a shift</button>
              <button className="btn-primary" onClick={startExtra}>Request extra</button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['pending','approved','rejected','all'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`btn ${filter === s ? 'bg-accent-orange text-cream' : 'bg-cream/10 text-cream/70 hover:bg-cream/20'}`}
          >{s[0].toUpperCase() + s.slice(1)}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.length === 0 && <div className="card-dark text-cream/60">No requests.</div>}
        {items.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-xl text-clay">{r.requester_name}</div>
                <div className="text-clay/60 text-sm">{r.shift_date} · {fmtTime(r.start_time)} – {fmtTime(r.end_time)} · {r.position || '—'}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge status={r.type} />
                <Badge status={r.status} />
              </div>
            </div>
            {r.reason && <p className="mt-3 text-clay/80 italic">"{r.reason}"</p>}
            {isAdmin && r.status === 'pending' && (
              <div className="mt-4 flex gap-2 justify-end">
                <button className="btn-ghost text-accent-red border-accent-red/40" onClick={() => decide(r.id, 'rejected')}>Reject</button>
                <button className="btn-success" onClick={() => decide(r.id, 'approved')}>Approve</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={creating === 'transfer' ? 'Transfer / cover a shift' : 'Request an extra shift'}
        footer={<>
          <button className="btn-ghost" onClick={() => setCreating(null)}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Submit</button>
        </>}
      >
        {err && <div className="text-accent-red text-sm">{err}</div>}
        {creating === 'transfer' ? (
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Which shift?</label>
            <select className="input" value={form.schedule_id || ''} onChange={(e) => setForm({...form, schedule_id: Number(e.target.value)})}>
              <option value="">— Select an upcoming shift —</option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shift_date} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)} · {s.position || '—'}
                </option>
              ))}
            </select>
            <label className="text-clay/70 text-sm font-medium block mt-3 mb-1">Reason</label>
            <textarea className="input" rows="3" value={form.reason || ''} onChange={(e) => setForm({...form, reason: e.target.value})} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-clay/70 text-sm font-medium block mb-1">Date</label>
              <input type="date" className="input" value={form.shift_date} onChange={(e) => setForm({...form, shift_date: e.target.value})} />
            </div>
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">Start</label>
              <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})} />
            </div>
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">End</label>
              <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="text-clay/70 text-sm font-medium block mb-1">Position</label>
              <input className="input" value={form.position} onChange={(e) => setForm({...form, position: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="text-clay/70 text-sm font-medium block mb-1">Reason</label>
              <textarea className="input" rows="3" value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
