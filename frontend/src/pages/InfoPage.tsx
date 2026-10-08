import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Compass } from 'lucide-react';

export function InfoPage({ kind = 'missing' }: { kind?: 'retired' | 'missing' }) {
  const title = kind === 'retired' ? 'A new direction for College Finder.' : 'That path is a little off the map.';
  const copy = kind === 'retired' ? 'The new experience focuses on finding courses, comparing costs, and planning your next steps. Community discussions and the old predictor have been retired.'
    : 'This page could not be found. Explore the colleges or pick up your shortlist.';
  return <section className="info-page"><span className="empty-symbol"><Compass size={33} /></span><p className="eyebrow">A thoughtful next step</p><h1>{title}</h1><p>{copy}</p><div><Link className="button primary" to="/explore">Explore colleges<ArrowRight size={16} /></Link><Link className="button secondary" to="/workspace"><Bookmark size={16} />My workspace</Link></div></section>;
}
