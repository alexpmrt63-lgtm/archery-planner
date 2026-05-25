import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './context/AuthContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import CoachDashboard from './components/coach/CoachDashboard.jsx';
import ArcherDashboard from './components/archer/ArcherDashboard.jsx';

function ProtectedRoute({ children, role }) {
  const { user } = useAuthContext();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuthContext();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/coach/*"
        element={
          <ProtectedRoute role="coach">
            <CoachDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/archer/*"
        element={
          <ProtectedRoute role="archer">
            <ArcherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          user
            ? <Navigate to={user.role === 'coach' ? '/coach' : '/archer'} replace />
            : <Navigate to="/login" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
