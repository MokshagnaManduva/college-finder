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
  if (!college) return <EmptyState title="We couldn't find that college.">Try another option from the directory.</EmptyState>;
  const course = college.courses.find(item => item.id === courseId) ?? college.courses[0];
  const option = { collegeId: college.id, courseId: course?.id ?? null };
  const compared = state.compare.some(item => optionKey(item) === optionKey(option));
  const saved = state.entries.some(item => optionKey(item) === optionKey(option));
  const sectionLink = (section: string) => window.location.protocol === 'file:' ? `?section=${section}` : `#${section}`;
  return <div className="detail-page"><Link className="back-link" to={exploreFrom}><ArrowLeft size={15} />Back to Explore</Link>
    <section className="detail-summary"><div><p className="eyebrow">{college.type} / {college.state}</p><h1>{college.name}</h1><p className="detail-location"><MapPin size={16} />{college.location}, {college.state}</p><div className="detail-tags">{college.established !== null && <span>Established {college.established}</span>}<span>{college.courses.length} course options</span><Link className="text-link" to="/sources">Official sources</Link></div></div><CampusImage src={college.image} name={college.name} className="detail-image" /></section>
    <nav className="detail-nav" aria-label="College sections"><Link to={sectionLink('overview')}>The overview</Link><Link to={sectionLink('courses')}>Courses & costs</Link><Link to={sectionLink('placements')}>Placements</Link><Link to={sectionLink('sources')}>About the data</Link></nav>
    <div className="detail-layout"><div className="detail-content"><section id="overview" className="detail-section"><p className="eyebrow">The overview</p><h2>Get a feel for the place.</h2><p>{college.description}</p>{college.facilities.length > 0 && <><h3>Around campus</h3><div className="facility-grid">{college.facilities.map(facility => <span key={facility}><Check size={14} />{facility}</span>)}</div></>}{college.source?.url && <a className="text-link" href={college.source.url} target="_blank" rel="noopener noreferrer">Visit the institution<ArrowRight size={14} /></a>}</section>
      <section id="courses" className="detail-section"><p className="eyebrow">Your academic options</p><div className="section-heading"><h2>Find your course.</h2><span className="muted">Choose an option to plan its costs</span></div>
        <div className="course-options">{college.courses.map(item => <button key={item.id} className={`course-option ${course?.id === item.id ? 'selected' : ''}`} aria-pressed={course?.id === item.id} onClick={() => setCourseId(item.id)}><span className="course-radio" /><span><strong>{item.name}</strong><small>{duration(item.durationMonths)} · {item.seats === null ? 'Seats unavailable' : item.seats + ' seats'}</small></span><span className="course-fee">{compactMoney(item.annualTuition)}<small>{tuitionLabel(item)}{item.tuitionEvidence?.source.reportingYear ? ` · ${item.tuitionEvidence.source.reportingYear}` : ""}</small></span></button>)}</div>
        {course && <CostCalculator key={course.id} college={college} course={course} />}
      </section>
      <section id="placements" className="detail-section"><p className="eyebrow">Life after the course</p><h2>Outcomes, with context.</h2>
        {college.placements.medianPackage != null ? <><p>{college.placements.scope} · graduating academic year {college.placements.reportingYear! - 1}–{String(college.placements.reportingYear).slice(-2)}.</p>
          <div className="placement-grid"><div><small>Median annual salary of placed graduates</small><strong>{money(college.placements.medianPackage)}</strong></div><div><small>Graduated in minimum stipulated time</small><strong>{college.placements.graduates}</strong></div><div><small>Students placed</small><strong>{college.placements.placed}</strong></div><div><small>Selected for higher studies</small><strong>{college.placements.higherStudies}</strong></div></div>
          <p className="fine-print">Institution-reported NIRF data covers the stated programme group across departments. It is not a salary prediction for the selected course. Counts do not establish a placement rate for job-seeking students.</p>
          <a className="text-link" href={college.placements.source?.url ?? undefined} target="_blank" rel="noopener noreferrer">{college.placements.source?.title}</a><p className="fine-print">{college.placements.source?.notes}</p>
        </> : <p>Reviewed placement outcomes are not available for this institution. Ask for a report with the programme, graduating year and salary definition before comparing outcomes.</p>}
      </section>
      <section id="sources" className="detail-section source-section"><Info size={21} /><div><h2>A starting point, with context.</h2><p>Institution profiles and published programmes link to official sources. Fees and durations have separate evidence; unavailable figures are left blank. Confirm your campus, admission year and fee category with the institution.</p><dl><div><dt>Profile source scope</dt><dd>{college.source?.notes ?? "Institution profile"}</dd></div><div><dt>Official source</dt><dd>{college.source?.url && /^https?:\/\//.test(college.source.url) ? <a className="text-link" href={college.source.url} target="_blank" rel="noopener noreferrer">{college.source.title}</a> : 'Not available'}</dd></div><div><dt>Last verified</dt><dd>{college.source?.verifiedAt ? new Date(college.source.verifiedAt).toLocaleDateString('en-IN') : 'Not available'}</dd></div></dl>{course?.source?.url && <p><a className="text-link" href={course.source.url} target="_blank" rel="noopener noreferrer">Selected programme · official source</a></p>}{course?.tuitionEvidence && <SourceNote evidence={course.tuitionEvidence} label="Selected course tuition" />}{course?.durationEvidence && <SourceNote evidence={course.durationEvidence} label="Selected course duration" />}</div></section>
    </div><aside className="detail-sidebar"><div className="option-panel"><p className="eyebrow">Your next move</p><h3>A place on your shortlist?</h3><p>Keep this option with your notes and application plans.</p>{course && <div className="selected-course-summary"><small>Selected course</small><strong>{course.name}</strong><span>{duration(course.durationMonths)} · {compactMoney(course.annualTuition)}/yr · {tuitionLabel(course)}</span></div>}
      <button className="button primary" onClick={() => addEntry(option)}><Bookmark size={16} />{saved ? 'In your workspace' : 'Add to workspace'}</button><button className="button secondary" aria-pressed={compared} onClick={() => toggleCompare(option)}><Scale size={16} />{compared ? 'Remove from compare' : 'Add to comparison'}</button><Link className="text-link" to="/workspace">Open your workspace<ArrowRight size={15} /></Link><p className="fine-print">{user ? 'Saved to your account.' : 'Saved on this browser. Sign in for account sync.'}</p></div></aside></div>
  </div>;
}
