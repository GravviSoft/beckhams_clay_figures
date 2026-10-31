import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, rememberAuthReturnPath } from '../services/auth';

// UI convenience only: the backend still rejects every unauthenticated request.
export default function ProtectedRoute() {
  const location = useLocation();
  if (isAuthenticated()) return <Outlet />;
  rememberAuthReturnPath(location.pathname);
  return <Navigate to="/login" replace />;
}
