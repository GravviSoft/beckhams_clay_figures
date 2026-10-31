import AuthForm from './AuthForm';
import { login } from './identityApi';

export default function LoginPage() {
  return <AuthForm title="Welcome back" submitLabel="Sign in" alternateText="Need an account?" alternatePath="/register" alternateLabel="Create one" action={login} />;
}
