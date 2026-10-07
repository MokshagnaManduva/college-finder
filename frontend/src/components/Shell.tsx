import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import { Compass, Scale, Bookmark, SlidersHorizontal, ArrowUpRight, X } from 'lucide-react';
import { useGuest } from '../state/GuestProvider';
import { useAuth } from '../state/AuthProvider';
import { DEMO_MODE } from '../api/client';
import { useCatalog } from '../state/CatalogProvider';
import { hasReviewedFacts } from '../domain/provenance';

const scrollPositions = new Map<string, number>();

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = location.key;
  const lastPath = useRef(location.pathname);
  const section = location.hash.slice(1) || new URLSearchParams(location.search).get('section');
  useLayoutEffect(() => {
    if (section) {
      const frame = requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView());
      return () => cancelAnimationFrame(frame);
    }
    if (lastPath.current !== location.pathname || navigationType === 'POP') {
      const frame = requestAnimationFrame(() => window.scrollTo(0, navigationType === 'POP' ? scrollPositions.get(key) ?? 0 : 0));
      lastPath.current = location.pathname;
      return () => { cancelAnimationFrame(frame); scrollPositions.set(key, window.scrollY); };
    }
    return () => { scrollPositions.set(key, window.scrollY); };
  }, [key, location.pathname, section, navigationType]);
  return null;
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, notice, storageError, notify } = useGuest();
  const { colleges } = useCatalog();
  const reviewed = hasReviewedFacts(colleges);
  const location = useLocation();
  const { user, logout, error } = useAuth();
  useEffect(() => {
    const names: Record<string, string> = { '/': 'Find your place', '/explore': 'Explore colleges', '/workspace': 'My workspace', '/compare': 'Compare options', '/preferences': 'Your preferences', '/sources': 'Sources and coverage', '/login': 'Sign in', '/register': 'Create account' };
    document.title = `${names[location.pathname] ?? 'College details'} · College Finder`;
  }, [location.pathname]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notify(''), 5000);
    return () => clearTimeout(timer);
  }, [notice, notify]);
  const links = [
    { to: '/explore', label: 'Explore', icon: Compass, count: 0 },
    { to: '/compare', label: 'Compare', icon: Scale, count: state.compare.length },
    { to: '/workspace', label: 'My workspace', icon: Bookmark, count: state.entries.length },
  ];
  return <>
    <ScrollManager />
    <a className="skip-link" href="#main" onClick={event => {
      event.preventDefault();
      document.getElementById('main')?.focus({ preventScroll: true });
      document.getElementById('main')?.scrollIntoView();
    }}>Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link to="/" className="wordmark" aria-label="College Finder home"><span className="brand-icon"><Compass size={23} strokeWidth={1.7} /></span>college<span>finder</span><i /></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(({ to, label, count }) =>
        <NavLink to={to} key={to}>{label}{count > 0 && <span className="nav-count">{count}</span>}</NavLink>)}</nav>
      <div className="header-tools"><Link to="/preferences" className="preferences-link"><SlidersHorizontal size={16} /><span>Your preferences</span></Link>
        {user ? <details className="account-menu"><summary className="guest-avatar" aria-label="Account menu">{user.name[0].toUpperCase()}</summary>
          <div className="account-popover"><strong>{user.name}</strong><span>{user.email}</span><Link to="/workspace">My workspace</Link><button onClick={logout}>Sign out</button></div>
        </details> : <Link to="/login" state={{ from: location.pathname + location.search }} className="button secondary signin-link">Sign in</Link>}</div>
    </div></header>
    <div className="demo-strip"><span className="demo-dot" /><Link className="source-banner-link" to="/sources">{DEMO_MODE ? 'Demo preview' : reviewed ? 'Source review in progress' : 'Demo college data'}</Link><span className="demo-copy">{reviewed ? 'Includes demo data. Check the source for each figure.' : 'College facts and costs are illustrative.'} {user ? 'Your workspace syncs to your account.' : 'Save here, or sign in to sync across devices.'}</span></div>
    {import.meta.env.VITE_TEMPORARY_DEMO === 'true' && <div className="storage-warning">Temporary demo. Export a workspace backup before this demo ends to keep your notes. <Link to="/workspace">Open workspace</Link></div>}
    {error && <div className="storage-warning" role="alert">{error}</div>}
    {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
    <main id="main" tabIndex={-1} className="main-container">{children}</main>
    <footer className="site-footer"><Link className="footer-brand" to="/">collegefinder<span>Make room for your next chapter.</span></Link>
      <span>Made for thoughtful decisions.</span><Link to="/preferences">Set your preferences <ArrowUpRight size={14} /></Link></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({ to, label, icon: Icon, count }) =>
      <NavLink key={to} to={to}><Icon size={21} /><span>{label}</span>{count > 0 && <b>{count}</b>}</NavLink>)}</nav>
    <div className="toast-region" aria-live="polite" aria-atomic="true">{notice && <div className="toast">{notice}
      <button className="icon-button" aria-label="Dismiss notification" onClick={() => notify('')}><X size={16} /></button></div>}</div>
  </>;
}
