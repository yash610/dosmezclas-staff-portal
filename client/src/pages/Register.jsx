import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Brand from '../components/Brand.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const [role, setRole] = useState('employee');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await register({ full_name: fullName, email, password, role, admin_code: adminCode });
    } catch (e) {
      setErr(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Brand />
        </div>

        <div className="card">
          <div className="text-center mb-6">
            <h1 className="font-display text-3xl text-clay font-bold">Create your account</h1>
            <p className="text-clay/60 text-sm mt-1">Join the Dos Mezclas staff portal</p>
          </div>

          {/* Role toggle */}
          <div className="flex rounded-2xl bg-cream-200 p-1 mb-5">
            <button
              type="button"
              onClick={() => setRole('employee')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                role === 'employee'
                  ? 'bg-accent-red text-cream shadow-warm'
                  : 'text-clay/60 hover:text-clay'
              }`}
            >
              Staff member
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                role === 'admin'
                  ? 'bg-accent-red text-cream shadow-warm'
                  : 'text-clay/60 hover:text-clay'
              }`}
            >
              Manager
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">Full name</label>
              <input
                className="input" type="text" autoComplete="name" placeholder="Maria Lopez"
                value={fullName} onChange={(e) => setFullName(e.target.value)} required
              />
            </div>
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">Email</label>
              <input
                className="input" type="email" autoComplete="email" placeholder="you@dosmezclas.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">Password</label>
              <input
                className="input" type="password" autoComplete="new-password" placeholder="Min 8 characters"
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              />
            </div>
            {role === 'admin' && (
              <div>
                <label className="text-clay/70 text-sm font-medium block mb-1">Manager access code</label>
                <input
                  className="input" type="password" placeholder="Provided by the restaurant owner"
                  value={adminCode} onChange={(e) => setAdminCode(e.target.value)} required
                />
                <p className="text-clay/50 text-xs mt-1">
                  Ask the restaurant owner for this code.
                </p>
              </div>
            )}

            {err && <div className="text-accent-red text-sm">{err}</div>}

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <div className="text-center mt-5 text-cream/60 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-cream font-semibold hover:underline">
            Sign in
          </Link>
        </div>

        <div className="text-center mt-4 text-cream/40 text-xs">
          Dos Mezclas Restaurant and Bar · Aubrey, TX
        </div>
      </div>
    </div>
  );
}
