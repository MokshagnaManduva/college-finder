import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bookmark, Check, MapPin, Scale, Info } from 'lucide-react';
import { collegesApi } from '../api';
import { compactMoney, duration, money, optionKey } from '../domain/college';
import { useGuest } from '../state/GuestProvider';
import { useAuth } from '../state/AuthProvider';
import { CampusImage, EmptyState, LoadingRows } from '../components/ui';
import { CostCalculator } from '../components/CostCalculator';
import { SourceNote } from '../components/SourceNote';
import { tuitionLabel } from '../domain/provenance';

export function CollegeDetailPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const { data: college, isPending, isError, refetch } = useQuery({ queryKey: ['college', slug], queryFn: () => collegesApi.detail(slug) });
  const [courseId, setCourseId] = useState<string | null>(() =>
    typeof location.state?.courseId === 'string' ? location.state.courseId : null);
  const exploreFrom = typeof location.state?.exploreFrom === 'string'
    && /^\/explore(?:\?|$)/.test(location.state.exploreFrom)
    ? location.state.exploreFrom : '/explore';
  const { state, addEntry, toggleCompare } = useGuest();
  const { user } = useAuth();
  useEffect(() => {
    const section = location.hash.slice(1) || new URLSearchParams(location.search).get('section');
    if (!college || !section) return;
    // The anchor may not exist during the shell's first frame while detail data resolves.
    const frame = requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [college, location.hash, location.search]);
  if (isPending) return <LoadingRows />;
  if (isError) return <div className="empty-state"><h1>We couldn't load this college.</h1><button className="button primary" onClick={() => refetch()}>Try again</button></div>;
  if (!college) return <EmptyState title="We couldn't find that college.">Try another option from the demo directory.</EmptyState>;
  const course = college.courses.find(item => item.id === courseId) ?? college.courses[0];
  const option = { collegeId: college.id, courseId: course?.id ?? null };
  const compared = state.compare.some(item => optionKey(item) === optionKey(option));
  const saved = state.entries.some(item => optionKey(item) === optionKey(option));
  const sectionLink = (section: string) => window.location.protocol === 'file:' ? `?section=${section}` : `#${section}`;
  return <div className="detail-page"><Link className="back-link" to={exploreFrom}><ArrowLeft size={15} />Back to Explore</Link>
    <section className="detail-summary"><div><p className="eyebrow">{college.type} / {college.state}</p><h1>{college.name}</h1><p className="detail-location"><MapPin size={16} />{college.location}, {college.state}</p><div className="detail-tags"><span>Established {college.established}</span><span>{college.courses.length} course options</span><span className="demo-tag">Demo data</span></div></div><CampusImage src={college.image} name={college.name} className="detail-image" /></section>
    <nav className="detail-nav" aria-label="College sections"><Link to={sectionLink('overview')}>The overview</Link><Link to={sectionLink('courses')}>Courses & costs</Link><Link to={sectionLink('placements')}>Placements</Link><Link to={sectionLink('sources')}>About the data</Link></nav>
    <div className="detail-layout"><div className="detail-content"><section id="overview" className="detail-section"><p className="eyebrow">The overview</p><h2>Get a feel for the place.</h2><p>{college.description}</p><h3>Around campus</h3><div className="facility-grid">{college.facilities.map(facility => <span key={facility}><Check size={14} />{facility}</span>)}</div><p className="fine-print">Campus information and the photograph are illustrative demo content.</p></section>
      <section id="courses" className="detail-section"><p className="eyebrow">Your academic options</p><div className="section-heading"><h2>Find your course.</h2><span className="muted">Choose an option to plan its costs</span></div>
        <div className="course-options">{college.courses.map(item => <button key={item.id} className={`course-option ${course?.id === item.id ? 'selected' : ''}`} aria-pressed={course?.id === item.id} onClick={() => setCourseId(item.id)}><span className="course-radio" /><span><strong>{item.name}</strong><small>{duration(item.durationMonths)} · {item.seats === null ? 'Seats unavailable' : item.seats + ' demo seats'}</small></span><span className="course-fee">{compactMoney(item.annualTuition)}<small>{tuitionLabel(item)}</small></span></button>)}</div>
        {course && <CostCalculator key={course.id} college={college} course={course} />}
      </section>
      <section id="placements" className="detail-section"><p className="eyebrow">Life after the course</p><h2>Look beyond the headline.</h2><p>These are inherited demo figures. Their reporting year and program scope are unavailable, so they should guide questions for your research.</p><div className="placement-grid"><div><small>Demo average package</small><strong>{money(college.placements.avgPackage)}</strong></div><div><small>Demo highest package</small><strong>{money(college.placements.highestPackage)}</strong></div><div><small>Demo placement rate</small><strong>{college.placements.placementRate === null ? 'Not available' : college.placements.placementRate + '%'}</strong></div></div><p className="fine-print">Package figures are shown as annual demo amounts. Verify the definition, reporting year, and applicable program with the institution.</p></section>
      <section id="sources" className="detail-section source-section"><Info size={21} /><div><h2>A starting point, with context.</h2><p>This preview uses the original project's sample college data. The college overview, facilities and placement figures remain demo data. Reviewed course claims are identified separately below. Confirm the scope and applicable fee category with the institution.</p><dl><div><dt>Data status</dt><dd>{college.source?.status ?? college.dataStatus}</dd></div><div><dt>Official source</dt><dd>{college.source?.url && /^https?:\/\//.test(college.source.url) ? <a className="text-link" href={college.source.url} target="_blank" rel="noopener noreferrer">{college.source.title}</a> : 'Not available'}</dd></div><div><dt>Last verified</dt><dd>{college.source?.verifiedAt ? new Date(college.source.verifiedAt).toLocaleDateString('en-IN') : 'Not available'}</dd></div></dl>{course?.tuitionEvidence && <SourceNote evidence={course.tuitionEvidence} label="Selected course tuition" />}{course?.durationEvidence && <SourceNote evidence={course.durationEvidence} label="Selected course duration" />}</div></section>
    </div><aside className="detail-sidebar"><div className="option-panel"><p className="eyebrow">Your next move</p><h3>A place on your shortlist?</h3><p>Keep this option with your notes and application plans.</p>{course && <div className="selected-course-summary"><small>Selected course</small><strong>{course.name}</strong><span>{duration(course.durationMonths)} · {compactMoney(course.annualTuition)}/yr · {tuitionLabel(course)}</span></div>}
      <button className="button primary" onClick={() => addEntry(option)}><Bookmark size={16} />{saved ? 'In your workspace' : 'Add to workspace'}</button><button className="button secondary" aria-pressed={compared} onClick={() => toggleCompare(option)}><Scale size={16} />{compared ? 'Remove from compare' : 'Add to comparison'}</button><Link className="text-link" to="/workspace">Open your workspace<ArrowRight size={15} /></Link><p className="fine-print">{user ? 'Saved to your account.' : 'Saved on this browser. Sign in for account sync.'}</p></div></aside></div>
  </div>;
}
