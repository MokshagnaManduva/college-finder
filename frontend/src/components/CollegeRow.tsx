import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Bookmark, Check, MapPin, Scale } from 'lucide-react';
import type { College, Course } from '../types';
import { compactMoney, minimumTuition, optionKey } from '../domain/college';
import { useGuest } from '../state/GuestProvider';
import { CampusImage } from './ui';

export function CollegeRow({ college, courses = college.courses, reasons = [], index }: {
  college: College; courses?: Course[]; reasons?: string[]; index?: number;
}) {
  const { state, addEntry, toggleCompare, notify } = useGuest();
  const location = useLocation();
  const detailState = {courseId: courses[0]?.id ?? null,
    ...(location.pathname === '/explore' ? {exploreFrom: location.pathname + location.search} : {})};
  const option = { collegeId: college.id, courseId: courses[0]?.id ?? null };
  const compared = state.compare.some(item => optionKey(item) === optionKey(option));
  const saved = state.entries.some(item => item.collegeId === college.id);
  const shortName = college.name.replace('Indian Institute of Technology', 'IIT').replace('National Institute of Technology', 'NIT');
  return <article className="college-row">
    <Link className="row-image-link" to={`/colleges/${college.slug}`} state={detailState} tabIndex={-1} aria-hidden="true"><CampusImage src={college.image} name={college.name} /></Link>
    <div className="row-main"><div className="row-eyebrow"><span>{college.type}</span><span className="row-number">{index !== undefined ? String(index + 1).padStart(2, '0') : 'Explore'}</span></div>
      <h3><Link to={`/colleges/${college.slug}`} state={detailState}>{shortName}<ArrowUpRight size={17} /></Link></h3>
      <p className="row-location"><MapPin size={13} />{college.city}, {college.state}{college.established !== null && <span>Est. {college.established}</span>}</p>
      <div className="course-tags">{courses.slice(0, 2).map(course => <span key={course.id}>{course.name}</span>)}{courses.length > 2 && <span>+{courses.length - 2} courses</span>}</div>
      {reasons.length > 0 && <p className="match-reason"><Check size={13} />{reasons.join(' · ')}</p>}
    </div>
    <div className="row-tuition"><small>{minimumTuition(courses) === null ? "Tuition unavailable" : "Known annual tuition from"}</small><strong>{compactMoney(minimumTuition(courses))}{minimumTuition(courses) !== null && <span> / yr</span>}</strong><span className="muted">{courses.length} course options</span></div>
    <div className="row-actions"><button className={`icon-button ${saved ? 'selected' : ''}`} aria-label={saved ? `${shortName} is in workspace` : `Save ${shortName} to workspace`} onClick={() => saved ? notify('This college already has an option in your workspace.') : addEntry({ collegeId: college.id, courseId: null })}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
      <button className={`compare-button ${compared ? 'selected' : ''}`} aria-pressed={compared} onClick={() => toggleCompare(option)}><Scale size={16} />{compared ? 'Added' : 'Compare'}</button></div>
  </article>;
}
