import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './app/AppLayout';
import ClayGalleryPage from './domains/clay_gallery/ClayGalleryPage';
import LoginPage from './domains/identity/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ClayGalleryPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
