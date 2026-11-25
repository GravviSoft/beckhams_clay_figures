import { useEffect, useRef, useState } from 'react';
import { AppButton } from '../../components/authenticated-ui/AuthenticatedUi';
import { loginWithPasskey, passkeyError } from './passkeyApi';
import './AuthForm.css';

export default function PasskeySignIn({ onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef(null);
  useEffect(() => () => attempt.current?.abort(), []);

  async function submit() {
    const controller = new AbortController();
    attempt.current = controller;
    setBusy(true);
    setMessage('');
    try {
      await loginWithPasskey(controller.signal);
      if (!controller.signal.aborted) onSuccess();
    } catch (error) {
      if (!controller.signal.aborted) setMessage(passkeyError(error));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="passkey-sign-in">
      <AppButton type="button" size="standard" icon="pi pi-key" label="Sign in with a passkey"
        variant="secondary" onClick={submit} loading={busy} disabled={busy} />
      {message && <p className="auth-form__error passkey-error" role="alert">{message}</p>}
      <p className="passkey-sign-in__divider">Or use your password</p>
    </div>
  );
}
