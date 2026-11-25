import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputText } from 'primereact/inputtext';
import { AppActionGroup, AppButton, AppField } from '../../components/authenticated-ui/AuthenticatedUi';
import { consumeAuthReturnPath } from '../../services/auth';
import './AuthForm.css';

export default function AuthForm({
  title, submitLabel, alternateText, alternatePath, alternateLabel, action,
  onSuccess, passwordAutoComplete = 'current-password', switchLabel, onSwitch,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await action({ email, password });
      if (onSuccess) onSuccess();
      else navigate(consumeAuthReturnPath('/'), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className={title ? 'auth-form' : 'auth-form auth-form--embedded'}>
      {title && <h1>{title}</h1>}
      <form className={title ? undefined : 'app-charcoal-form'} onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <AppField label="Email" htmlFor="auth-email">
            <InputText id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </AppField>
          <AppField label="Password" htmlFor="auth-password">
            <InputText id="auth-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={passwordAutoComplete} required />
          </AppField>
        </fieldset>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <AppActionGroup align={onSwitch ? 'between' : 'end'}>
          {onSwitch && <AppButton type="button" variant="text" label={switchLabel} onClick={onSwitch} disabled={busy} />}
          <AppButton type="submit" size="standard" label={submitLabel} loading={busy} disabled={busy} />
        </AppActionGroup>
      </form>
      {alternateText && (
        <p className="auth-form__alternate">{alternateText} {alternatePath && <Link to={alternatePath}>{alternateLabel}</Link>}</p>
      )}
    </section>
  );
}
