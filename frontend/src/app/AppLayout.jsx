import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppButton, AppFormDialog } from '../components/authenticated-ui/AuthenticatedUi';
import { getAuthoring } from '../domains/clay_gallery/galleryApi';
import AuthForm from '../domains/identity/AuthForm';
import PasskeySetup from '../domains/identity/PasskeySetup';
import PasskeySignIn from '../domains/identity/PasskeySignIn';
import { login, logout, register } from '../domains/identity/identityApi';
import { supportsPasskeys } from '../domains/identity/passkeyApi';
import { isUnauthorizedError } from '../services/api';
import { getAuthToken, subscribeAuthSession } from '../services/auth';
import './AppLayout.css';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const authToken = useSyncExternalStore(subscribeAuthSession, getAuthToken);
  const signedIn = Boolean(authToken);
  const [authMode, setAuthMode] = useState(null);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [reauthenticating, setReauthenticating] = useState(false);
  const afterSignIn = useRef([]);
  const registering = authMode === 'register';
  const [authoring, setAuthoring] = useState(null);
  const currentAuthoring = authoring?.token === authToken ? authoring : null;

  const requestSignIn = useCallback((resume) => {
    if (resume) afterSignIn.current.push(resume);
    setReauthenticating(true);
    setAuthMode('login');
  }, []);

  function closeSignIn() {
    afterSignIn.current = [];
    setReauthenticating(false);
    setAuthMode(null);
  }

  function finishSignIn() {
    const pending = afterSignIn.current;
    closeSignIn();
    if (getAuthToken()) pending.forEach((resume) => resume());
  }

  useEffect(() => {
    if (!authToken) return undefined;
    let active = true;
    getAuthoring()
      .then((data) => {
        if (active) {
          setAuthoring((previous) => ({
            token: authToken,
            canFeature: Boolean(data.can_feature),
            ids: [...new Set([
              ...(previous?.token === authToken ? previous.ids : []),
              ...(data.editable_figure_ids ?? []),
            ])],
          }));
        }
      })
      .catch((err) => {
        if (isUnauthorizedError(err) && !getAuthToken()) requestSignIn();
      });
    return () => { active = false; };
  }, [authToken, requestSignIn]);

  return (
    <>
      <nav className="app-nav">
        <Link to="/" className="app-nav__brand">Beck's Clay Figures</Link>
        <div className="app-nav__actions">
          {!signedIn && location.pathname !== '/login' && (
            <AppButton variant="text" label="Sign in" onClick={() => setAuthMode('login')} />
          )}
          {signedIn && supportsPasskeys() && (
            <AppButton variant="text" icon="pi pi-key" label="Add a passkey" onClick={() => setShowPasskeySetup(true)} />
          )}
          {signedIn && (
            <AppButton variant="text" icon="pi pi-sign-out" label="Sign out" onClick={() => {
              logout();
              setAuthoring(null);
              navigate('/');
            }} />
          )}
        </div>
      </nav>
      <main className={location.pathname === '/' ? 'app-content app-content--gallery' : 'app-content'}>
        <Outlet context={{
          signedIn,
          canFeature: Boolean(currentAuthoring?.canFeature),
          editableFigureIds: currentAuthoring?.ids ?? [],
          requestSignIn,
          markEditable: (id, token = authToken) => {
            if (token && token === getAuthToken()) {
              setAuthoring((previous) => ({
                token,
                canFeature: previous?.token === token && previous.canFeature,
                ids: [...new Set([...(previous?.token === token ? previous.ids : []), id])],
              }));
            }
          },
        }} />
      </main>
      {authMode && (
        <AppFormDialog visible modal appearance="charcoal" className="app-auth-dialog"
          title={registering ? 'Create an account' : 'Sign in'} onHide={closeSignIn}>
          {reauthenticating && <p className="app-auth-dialog__notice">Your session ended. Sign in to continue.</p>}
          {!registering && supportsPasskeys() && <PasskeySignIn onSuccess={finishSignIn} />}
          <AuthForm key={authMode} submitLabel={registering ? 'Create account' : 'Sign in'}
            passwordAutoComplete={registering ? 'new-password' : 'current-password'}
            action={registering ? register : login} onSuccess={finishSignIn}
            switchLabel={registering ? 'Back to sign in' : 'Create an account'}
            onSwitch={() => setAuthMode(registering ? 'login' : 'register')} />
        </AppFormDialog>
      )}
      {signedIn && showPasskeySetup && <PasskeySetup onClose={() => setShowPasskeySetup(false)} />}
    </>
  );
}
