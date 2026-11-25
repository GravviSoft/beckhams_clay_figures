import { useEffect, useRef, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { AppActionGroup, AppButton, AppField, AppFormDialog } from '../../components/authenticated-ui/AuthenticatedUi';
import { addPasskey, passkeyError } from './passkeyApi';
import './AuthForm.css';

export default function PasskeySetup({ onClose }) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef(null);
  useEffect(() => () => attempt.current?.abort(), []);

  async function submit(event) {
    event.preventDefault();
    const controller = new AbortController();
    attempt.current = controller;
    setBusy(true);
    setMessage('');
    try {
      await addPasskey(password, controller.signal);
      if (!controller.signal.aborted) {
        setPassword('');
        setAdded(true);
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(passkeyError(error));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <AppFormDialog visible modal appearance="charcoal" className="app-auth-dialog" title="Add a passkey" onHide={onClose}>
      {added ? (
        <>
          <p role="status">Passkey added. You can use it the next time you sign in.</p>
          <AppActionGroup><AppButton type="button" label="Done" onClick={onClose} /></AppActionGroup>
        </>
      ) : (
        <form className="app-charcoal-form" onSubmit={submit} aria-busy={busy}>
          <p className="app-auth-dialog__notice">Confirm your password, then follow your device’s prompt.</p>
          <fieldset disabled={busy}>
            <AppField label="Current password" htmlFor="passkey-password">
              <InputText id="passkey-password" type="password" value={password}
                onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </AppField>
          </fieldset>
          {message && <p className="auth-form__error passkey-error" role="alert">{message}</p>}
          <AppActionGroup>
            <AppButton type="button" variant="text" label="Cancel" onClick={onClose} />
            <AppButton type="submit" size="standard" label="Create passkey" loading={busy} disabled={busy} />
          </AppActionGroup>
        </form>
      )}
    </AppFormDialog>
  );
}
