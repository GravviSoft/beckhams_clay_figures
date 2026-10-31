import AuthForm from './AuthForm';
import { register } from './identityApi';

export default function RegisterPage() {
  return <AuthForm title="Create an account" submitLabel="Create account" alternateText="Already registered?" alternatePath="/login" alternateLabel="Sign in" action={register} />;
}
