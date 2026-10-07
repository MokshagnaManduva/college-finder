import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search, Compass, Bookmark, Scale, Check, MoveRight, SlidersHorizontal } from 'lucide-react';
import { useCatalog } from '../state/CatalogProvider';
import { CollegeRow } from '../components/CollegeRow';
import { useGuest } from '../state/GuestProvider';

export function HomePage() {
  const { colleges: demoColleges } = useCatalog();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { state } = useGuest();
  const submit = (event: FormEvent) => { event.preventDefault(); navigate(`/explore${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`); };
  const featured = ['iit-bombay', 'bits-pilani', 'delhi-university'].map(slug => demoColleges.find(college => college.slug === slug)!);
  return <div className="home-page">
    <section className="home-intro"><div className="intro-copy"><p className="eyebrow"><span />A little clarity. A big next step.</p>
      <h1>Find your place.<br /><em>Plan your next chapter.</em></h1>
      <p className="intro-description">Bring your options into focus. Explore colleges, understand the costs, and make a shortlist that feels like you.</p>
      <form className="hero-search" onSubmit={submit}><Search size={21} /><input aria-label="Search colleges, courses or cities" placeholder="A college, a course, a city…" value={search} onChange={event => setSearch(event.target.value)} /><button className="button primary" type="submit">Explore<ArrowRight size={17} /></button></form>
      <div className="quick-search"><span>A place to start</span>{['Engineering', 'Computer Science', 'MBA'].map(term => <Link to={`/explore?search=${encodeURIComponent(term)}`} key={term}>{term}<ArrowUpRight size={12} /></Link>)}</div>
    </div>
    <aside className="decision-card"><div className="decision-heading"><span className="eyebrow">Your decision, made simpler</span><Compass size={22} /></div>
      <h2>From a world of options<br />to your own direction.</h2>
      <div className="journey-step"><span className="step-symbol"><Search size={18} /></span><div><strong>Discover what fits</strong><p>Start with your interests and budget.</p></div><span>01</span></div>
      <div className="journey-step"><span className="step-symbol"><Scale size={18} /></span><div><strong>See the tradeoffs</strong><p>Courses, costs, and the bigger picture.</p></div><span>02</span></div>
      <div className="journey-step"><span className="step-symbol"><Bookmark size={18} /></span><div><strong>Make your next move</strong><p>Keep notes and applications together.</p></div><span>03</span></div>
      <Link className="decision-link" to="/preferences">Start with your preferences<ArrowUpRight size={18} /></Link>
    </aside></section>
    <section className="home-context"><div><span className="context-mark"><Check size={16} /></span><span>Explore on your terms<strong>No account needed to get started.</strong></span></div>
      <div><span className="context-mark"><SlidersHorizontal size={16} /></span><span>Make it personal<strong>Your priorities guide the search.</strong></span></div>
      <Link to="/workspace"><span className="context-mark"><Bookmark size={16} /></span><span>{state.entries.length ? 'Pick up where you left off' : 'A space for your shortlist'}<strong>{state.entries.length ? `${state.entries.length} saved ${state.entries.length === 1 ? 'option' : 'options'} in your workspace.` : 'Your ideas, notes, and next steps.'}</strong></span><ArrowUpRight size={18} /></Link>
    </section>
    <section className="home-discover"><div className="section-heading"><div><p className="eyebrow">Room to explore</p><h2>A few places to begin.</h2></div><Link className="text-link" to="/explore">All {demoColleges.length} colleges<ArrowRight size={16} /></Link></div>
      <div className="college-list">{featured.map((college, index) => <CollegeRow key={college.id} college={college} index={index} />)}</div>
      <div className="quiet-note"><span>Good decisions start with good questions.</span><Link to="/preferences">What matters most to you?<MoveRight size={17} /></Link></div>
    </section>
  </div>;
}
