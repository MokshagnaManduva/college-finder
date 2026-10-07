import { Component, useEffect, useId, useRef, type ReactNode, type ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, X } from 'lucide-react';

export function EmptyState({ title, children, action = 'Explore colleges', to = '/explore' }: {
  title: string; children: ReactNode; action?: string; to?: string;
}) {
  return <div className="empty-state"><span className="empty-symbol"><GraduationCap size={30} /></span>
    <h2>{title}</h2><p>{children}</p><Link className="button primary" to={to}>{action}<ArrowRight size={16} /></Link>
  </div>;
}

export function LoadingRows() {
  return <div aria-label="Loading colleges" aria-busy="true" className="loading-rows">
    {[0, 1, 2].map(index => <div className="skeleton-row" key={index}><div /><span /><span /></div>)}
  </div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll: true});
    };
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2>
      <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export function CampusImage({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  return <div className={`campus-image ${className}`}>
    <span aria-hidden="true"><GraduationCap size={36} /></span>
    <img src={src} alt={`Illustrative campus photograph for ${name}`} loading="lazy"
      onError={event => { event.currentTarget.style.display = 'none'; }} />
  </div>;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info.componentStack); }
  render() {
    if (this.state.hasError) return <div className="error-screen"><h1>Something interrupted your visit.</h1>
      <p>Reload to try again. Saved account entries stay in your account; guest entries stay in this browser.</p>
      <button className="button primary" onClick={() => window.location.reload()}>Reload page</button></div>;
    return this.props.children;
  }
}
