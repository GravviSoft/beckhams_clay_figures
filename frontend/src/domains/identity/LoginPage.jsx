import AuthForm from './AuthForm';
import { login } from './identityApi';

export default function LoginPage() {
  return <AuthForm title="Upload access" submitLabel="Continue" alternateText="The gallery is public. This password is only required to add new work." action={login} />;
}
