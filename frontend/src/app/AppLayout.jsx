import { Link, Outlet, useNavigate } from 'react-router-dom';
import { AppButton } from '../components/authenticated-ui/AuthenticatedUi';
import { logout } from '../domains/identity/identityApi';
import { isAuthenticated } from '../services/auth';
import './AppLayout.css';

export default function AppLayout() {
  const navigate = useNavigate();
  const signedIn = isAuthenticated();

  return (
    <>
      <nav className="app-nav">
        <Link to="/" className="app-nav__brand">Beck's Clay Figures</Link>
        <div className="app-nav__actions">
          {signedIn
            ? <AppButton variant="text" icon="pi pi-sign-out" label="Sign out" onClick={() => { logout(); navigate('/login'); }} />
            : <><Link to="/login">Sign in</Link><Link to="/register">Register</Link></>}
        </div>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </>
  );
}
