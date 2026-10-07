import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Bookmark, Eye, EyeOff, LogIn } from 'lucide-react';
import { authApi } from '../api';
import { DEMO_MODE } from '../api/client';
import { useAuth } from '../state/AuthProvider';
import { safeReturnPath } from '../domain/session';

export function AuthPage({ register = false }: {register?: boolean}) {
  const { user, establish } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeReturnPath((location.state as {from?: string} | null)?.from);
  if (user) return <Navigate to={from} replace />;
  if (DEMO_MODE) return <section className="info-page"><p className="eyebrow">Your workspace, wherever you go</p><h1>Open the connected app to sign in.</h1><p>This standalone preview saves on your browser. Open the local app to create an account and sync your workspace. Export a JSON backup from My workspace to move your preview notes into the connected app.</p><div><a className="button primary" href="http://localhost:5173/login">Open connected app<ArrowRight size={16} /></a><Link className="button secondary" to="/workspace"><Bookmark size={16} />My workspace</Link></div></section>;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (new TextEncoder().encode(password).length > 72) { setError('Use a password of at most 72 UTF-8 bytes.'); return; }
    setPending(true);
    try {
      const response = register ? await authApi.register({ name: name.trim(), email, password }) : await authApi.login({ email, password });
      establish(response.access_token, response.user);
      navigate(from, { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in could not finish. Please try again.'); }
    finally { setPending(false); }
  };
  return <section className="auth-page"><div className="auth-intro"><p className="eyebrow">Your next chapter, in one place</p><h1>{register ? 'A workspace that goes with you.' : 'Welcome back to your next chapter.'}</h1><p>Keep your shortlist, cost estimates, and next steps together across your devices.</p><div className="auth-benefit"><Bookmark size={19} /><span>Your existing browser options will be merged with your account. Different versions are kept for you to review.</span></div><Link className="text-link" to="/explore">Keep exploring as a guest<ArrowRight size={15} /></Link></div>
    <form className="auth-form panel" onSubmit={submit}><p className="eyebrow">{register ? 'Create your account' : 'Your account'}</p><h2>{register ? 'Make it your own.' : 'Sign in.'}</h2>
      {error && <p className="form-error" role="alert">{error}</p>}
      {register && <label>Your name<input autoComplete="name" value={name} required minLength={2} maxLength={80} onChange={event => setName(event.target.value)} /></label>}
      <label>Email address<input type="email" autoComplete="email" value={email} required maxLength={254} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} value={password} required minLength={register ? 8 : 1} maxLength={72} onChange={event => setPassword(event.target.value)} /><button className="icon-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{register && <small>At least 8 characters; at most 72 UTF-8 bytes.</small>}</label>
      <button className="button primary" type="submit" disabled={pending}><LogIn size={16} />{pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      <p>{register ? 'Already have an account?' : 'New here?'} <Link to={register ? '/login' : '/register'} state={{ from }}>{register ? 'Sign in' : 'Create an account'}<ArrowRight size={12} /></Link></p>
    </form>
  </section>;
}
