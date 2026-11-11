import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Trash2, UserRound } from 'lucide-react';
import { authApi } from '../api';
import { DEMO_MODE } from '../api/client';
import { useAuth } from '../state/AuthProvider';
import { useGuest } from '../state/GuestProvider';

const tooLong = (value: string) => new TextEncoder().encode(value).length > 72;

export function AccountPage() {
  const { user, establish, logout } = useAuth();
  const { notify, state } = useGuest();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [removal, setRemoval] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState<{form: 'password' | 'sessions' | 'delete'; message: string} | null>(null);
  if (DEMO_MODE || !user) return <Navigate to="/login" state={{ from: '/account' }} replace />;
  const run = async (form: 'password' | 'sessions' | 'delete', action: () => Promise<void>) => {
    setError(null); setPending(form);
    try { await action(); }
    catch (err) { setError({ form, message: err instanceof Error ? err.message : 'That could not be completed. Please try again.' }); }
    finally { setPending(''); }
  };
  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    if (next !== confirm) { setError({ form: 'password', message: 'The new passwords do not match.' }); return; }
    if (tooLong(next)) { setError({ form: 'password', message: 'Use a password of at most 72 UTF-8 bytes.' }); return; }
    void run('password', async () => {
      const response = await authApi.changePassword({ currentPassword: current, newPassword: next });
      establish(response.access_token, response.user);
      setCurrent(''); setNext(''); setConfirm('');
      notify('Your password is changed. Other devices need to sign in again.');
    });
  };
  const signOutEverywhere = () => void run('sessions', async () => {
    const response = await authApi.logoutEverywhere();
    establish(response.access_token, response.user);
    notify('Other devices are signed out. This browser stays signed in.');
  });
  const deleteAccount = (event: FormEvent) => {
    event.preventDefault();
    void run('delete', async () => {
      await authApi.deleteAccount(removal);
      logout();
      navigate('/', { replace: true });
    });
  };
  const message = (form: 'password' | 'sessions' | 'delete') =>
    error?.form === form && <p className="form-error" role="alert">{error.message}</p>;
  return <div className="account-page"><div className="page-heading"><div><p className="eyebrow">Your account</p><h1>Keep it yours.</h1><p>Manage how you sign in and what College Finder keeps for you.</p></div><UserRound size={26} /></div>
    <div className="account-sections">
      <section className="panel account-section"><h2>Your details</h2>
        <dl><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Saved options</dt><dd>{state.entries.length}</dd></div></dl>
      </section>
      <form className="panel account-section" onSubmit={changePassword}><h2><KeyRound size={18} />Change your password</h2>
        <p>Changing your password signs out your other devices.</p>{message('password')}
        <label>Current password<input type="password" autoComplete="current-password" required maxLength={72} value={current} onChange={event => setCurrent(event.target.value)} /></label>
        <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={next} onChange={event => setNext(event.target.value)} /><small>At least 8 characters; at most 72 UTF-8 bytes.</small></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
        <button className="button primary" type="submit" disabled={pending !== ''}>{pending === 'password' ? 'Please wait…' : 'Change password'}</button>
      </form>
      <section className="panel account-section"><h2><LogOut size={18} />Signed in somewhere else?</h2>
        <p>Sign out every other browser and device. You stay signed in here.</p>{message('sessions')}
        <button className="button secondary" type="button" disabled={pending !== ''} onClick={signOutEverywhere}>{pending === 'sessions' ? 'Please wait…' : 'Sign out other devices'}</button>
      </section>
      <form className="panel account-section danger-section" onSubmit={deleteAccount}><h2><Trash2 size={18} />Delete your account</h2>
        <p>This permanently removes your account, preferences and all {state.entries.length} saved workspace {state.entries.length === 1 ? 'option' : 'options'} with their notes. Export a backup from My workspace first if you want to keep them.</p>{message('delete')}
        {confirmRemoval ? <><label>Enter your password to confirm<input type="password" autoComplete="current-password" required maxLength={72} value={removal} onChange={event => setRemoval(event.target.value)} /></label>
          <div className="account-actions"><button className="button secondary" type="button" onClick={() => { setConfirmRemoval(false); setRemoval(''); setError(null); }}>Keep my account</button><button className="button danger" type="submit" disabled={pending !== ''}>{pending === 'delete' ? 'Please wait…' : 'Delete account permanently'}</button></div></>
          : <button className="text-link danger-text" type="button" onClick={() => setConfirmRemoval(true)}>Delete my account…</button>}
      </form>
    </div>
  </div>;
}
