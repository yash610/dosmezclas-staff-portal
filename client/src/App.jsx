import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import Employees from './pages/Employees.jsx';
import Schedule from './pages/Schedule.jsx';
import Availability from './pages/Availability.jsx';
import Requests from './pages/Requests.jsx';
import Reports from './pages/Reports.jsx';

function Private({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-cream/70">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/me'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<Private><Layout /></Private>}>
        <Route index element={<HomeRedirect />} />

        {/* Admin */}
        <Route path="admin" element={<Private role="admin"><AdminDashboard /></Private>} />
        <Route path="employees" element={<Private role="admin"><Employees /></Private>} />
        <Route path="schedule" element={<Private><Schedule /></Private>} />
        <Route path="requests" element={<Private><Requests /></Private>} />
        <Route path="reports" element={<Private><Reports /></Private>} />

        {/* Employee */}
        <Route path="me" element={<Private><EmployeeDashboard /></Private>} />
        <Route path="availability" element={<Private><Availability /></Private>} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
