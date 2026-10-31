import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './app/AppLayout';
import ProtectedRoute from './app/ProtectedRoute';
import LoginPage from './domains/identity/LoginPage';
import RegisterPage from './domains/identity/RegisterPage';
import DashboardWorkspace from './workspaces/dashboard/DashboardWorkspace';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardWorkspace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
