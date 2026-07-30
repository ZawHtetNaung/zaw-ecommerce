import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false, requireSuperAdmin = false }) {
  const location = useLocation();
  const { isAuthenticated, isAdmin, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return <p className="text-center mt-5">Loading...</p>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={requireAdmin || requireSuperAdmin ? '/admin/login' : '/login'}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to={isAdmin ? '/dashboard/overview' : '/admin/login'} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ accessMessage: 'Please sign in with an approved administrator account.' }}
      />
    );
  }

  return children;
}
