import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputText } from 'primereact/inputtext';
import { AppButton, AppField } from '../../components/authenticated-ui/AuthenticatedUi';
import { consumeAuthReturnPath } from '../../services/auth';
import './AuthForm.css';

export default function AuthForm({ title, submitLabel, alternateText, alternatePath, alternateLabel, action }) {
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
      navigate(consumeAuthReturnPath('/'), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="auth-form">
      <h1>{title}</h1>
      <form onSubmit={submit}>
        <AppField label="Email" htmlFor="auth-email">
          <InputText id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </AppField>
        <AppField label="Password" htmlFor="auth-password">
          <InputText id="auth-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </AppField>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <AppButton type="submit" size="standard" label={busy ? 'Please wait…' : submitLabel} disabled={busy} />
      </form>
      <p className="auth-form__alternate">{alternateText} <Link to={alternatePath}>{alternateLabel}</Link></p>
    </section>
  );
}
