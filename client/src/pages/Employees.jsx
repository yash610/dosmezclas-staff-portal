import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';

const empty = {
  full_name: '', email: '', phone: '', role_id: '',
  hourly_rate: 0, hire_date: '', notes: '', password: '',
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState(null); // null | employee | 'new'
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');

  function load() {
    api.get(`/api/employees?includeInactive=${includeInactive}`).then(setEmployees);
  }
  useEffect(() => { load(); }, [includeInactive]);
  useEffect(() => { api.get('/api/employees/roles').then(setRoles); }, []);

  function startNew() {
    setForm(empty); setErr(''); setEditing('new');
  }
  function startEdit(e) {
    setForm({
      full_name: e.full_name || '', email: e.email || '', phone: e.phone || '',
      role_id: e.role_id || '', hourly_rate: e.hourly_rate || 0,
      hire_date: e.hire_date || '', notes: e.notes || '', password: '',
    });
    setEditing(e); setErr('');
  }
  async function save() {
    setErr('');
    try {
      if (editing === 'new') {
        await api.post('/api/employees', form);
      } else {
        const { password, email, ...rest } = form;
        await api.patch(`/api/employees/${editing.id}`, rest);
      }
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
  }
  async function deactivate(e) {
    if (!confirm(`Deactivate ${e.full_name}? They won't be able to log in.`)) return;
    await api.patch(`/api/employees/${e.id}/deactivate`);
    load();
  }
  async function activate(e) {
    await api.patch(`/api/employees/${e.id}/activate`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="section-title">Team</h1>
          <p className="section-sub">Manage the Dos Mezclas crew.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-cream/70 text-sm flex items-center gap-2">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Show inactive
          </label>
          <button onClick={startNew} className="btn-primary">+ New employee</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-clay/60 border-b border-clay/10">
              <th className="py-3 px-2">Name</th>
              <th className="py-3 px-2">Role</th>
              <th className="py-3 px-2">Email</th>
              <th className="py-3 px-2">Phone</th>
              <th className="py-3 px-2">Rate</th>
              <th className="py-3 px-2">Status</th>
              <th className="py-3 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-clay/5 last:border-0">
                <td className="py-3 px-2 font-semibold text-clay">{e.full_name}</td>
                <td className="py-3 px-2 text-clay/80">{e.role_name || '—'}</td>
                <td className="py-3 px-2 text-clay/70">{e.email || '—'}</td>
                <td className="py-3 px-2 text-clay/70">{e.phone || '—'}</td>
                <td className="py-3 px-2 text-clay/80">${Number(e.hourly_rate || 0).toFixed(2)}/hr</td>
                <td className="py-3 px-2"><Badge status={e.is_active ? 'active' : 'inactive'} /></td>
                <td className="py-3 px-2 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(e)} className="text-accent-orange font-semibold hover:underline mr-3">Edit</button>
                  {e.is_active
                    ? <button onClick={() => deactivate(e)} className="text-accent-red font-semibold hover:underline">Deactivate</button>
                    : <button onClick={() => activate(e)} className="text-accent-green font-semibold hover:underline">Reactivate</button>}
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan="7" className="py-10 text-center text-clay/60">No employees yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add employee' : `Edit ${editing?.full_name || ''}`}
        footer={<>
          <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}
      >
        {err && <div className="text-accent-red text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-clay/70 text-sm font-medium block mb-1">Full name</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} />
          </div>
          {editing === 'new' && (
            <>
              <div>
                <label className="text-clay/70 text-sm font-medium block mb-1">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="text-clay/70 text-sm font-medium block mb-1">Temp password</label>
                <input className="input" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
              </div>
            </>
          )}
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Role</label>
            <select className="input" value={form.role_id} onChange={(e) => setForm({...form, role_id: e.target.value ? Number(e.target.value) : ''})}>
              <option value="">— Select —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Hourly rate</label>
            <input className="input" type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({...form, hourly_rate: Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-clay/70 text-sm font-medium block mb-1">Hire date</label>
            <input className="input" type="date" value={form.hire_date || ''} onChange={(e) => setForm({...form, hire_date: e.target.value})} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-clay/70 text-sm font-medium block mb-1">Notes</label>
            <textarea className="input" rows="3" value={form.notes || ''} onChange={(e) => setForm({...form, notes: e.target.value})}></textarea>
          </div>
        </div>
      </Modal>
    </div>
  );
}
