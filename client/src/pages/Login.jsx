import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Brand from '../components/Brand.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setErr(e.message || 'Login failed');
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
            <h1 className="font-display text-3xl text-clay font-bold">Welcome back</h1>
            <p className="text-clay/60 text-sm mt-1">Sign in to the Dos Mezclas staff portal</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">Email</label>
              <input
                className="input" type="email" autoComplete="email"
                value={email} onChange={(e)=>setEmail(e.target.value)} required
              />
            </div>
            <div>
              <label className="text-clay/70 text-sm font-medium block mb-1">Password</label>
              <input
                className="input" type="password" autoComplete="current-password"
                value={password} onChange={(e)=>setPassword(e.target.value)} required
              />
            </div>
            {err && <div className="text-accent-red text-sm">{err}</div>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

        </div>

        <div className="text-center mt-5 text-cream/60 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-cream font-semibold hover:underline">
            Create one
          </Link>
        </div>

        <div className="text-center mt-4 text-cream/40 text-xs">
          Dos Mezclas Restaurant and Bar · Aubrey, TX
        </div>
      </div>
    </div>
  );
}
