import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bookmark, Check, Link2, Plus, Scale, X } from 'lucide-react';
import { useCatalog } from '../state/CatalogProvider';
import { canonicalOption } from '../state/guestStorage';
import type { Option } from '../types';
import { useGuest } from '../state/GuestProvider';
import { courseMatch, duration, estimateCost, money, optionKey, resolveComparison } from '../domain/college';
import { EmptyState } from '../components/ui';
import { tuitionLabel, lowestComparableTuition } from '../domain/provenance';

export function ComparePage() {
  const { colleges: demoColleges } = useCatalog();
  const { state, setCompare, addEntry, notify } = useGuest();
  const [params, setParams] = useSearchParams();
  const [section, setSection] = useState('All details');
  const encoded = params.get('options');
  const seen = new Set<string>();
  const urlOptions: Option[] = (encoded ?? '').split(',').flatMap(value => {
    const [legacyCollegeId, rawCourseId] = value.split(':');
    const canonical = canonicalOption({collegeId: legacyCollegeId, courseId: rawCourseId || null});
    const collegeId = canonical?.collegeId ?? legacyCollegeId;
    const college = demoColleges.find(item => item.id === collegeId);
    if (!college) return [];
    const courseId = canonical?.courseId ?? rawCourseId ?? null;
    if (courseId && !college.courses.some(course => course.id === courseId)) return [];
    const option = { collegeId, courseId };
    if (seen.has(optionKey(option))) return [];
    seen.add(optionKey(option));
    return [option];
  }).slice(0, 3);
  const requested = encoded !== null ? urlOptions : state.compare;
  const resolved = resolveComparison(requested, demoColleges);
  const options = resolved.map(item => item.option);
  const unavailableCount = requested.length - resolved.length;
  const selected = resolved.map(({option, college, course}) => {
    const saved = state.entries.find(entry => optionKey(entry) === optionKey(option));
    const cost = saved?.scenario && course ? estimateCost(saved.scenario, course.durationMonths) : null;
    return { college, course, option, cost, reasons: course ? courseMatch(college, course, state.preferences)?.reasons ?? [] : [] };
  });
  const change = (next: Option[]) => { setCompare(next); setParams({ options: next.map(optionKey).join(',') }, { replace: true }); };
  const lowestTuition = lowestComparableTuition(selected.map(item => item.course));
  const fullCosts = selected.filter(item => item.cost?.complete).map(item => item.cost!.total);
  const lowestCost = fullCosts.length > 1 ? Math.min(...fullCosts) : null;
  const show = (name: string) => section === 'All details' || section === name;
  const courseSection = window.location.protocol === 'file:' ? '?section=courses' : '#courses';
  const copyLink = async () => {
    const base = window.location.protocol === 'file:' ? `${window.location.href.split('#')[0]}#/compare` : `${window.location.origin}/compare`;
    const url = `${base}?options=${encodeURIComponent(options.map(optionKey).join(','))}`;
    try { await navigator.clipboard.writeText(url); notify('Comparison link copied. It contains college/course choices only.'); }
    catch { notify('Copy the comparison URL from your address bar.'); setParams({ options: options.map(optionKey).join(',') }); }
  };
  return <div className="compare-page"><div className="page-heading"><div><p className="eyebrow">See the tradeoffs</p><h1>Different paths. A clearer picture.</h1><p>Put your options side by side, then decide what matters most.</p></div><span className="page-stamp"><Scale size={22} />Compare / 02</span></div>
    {unavailableCount > 0 && <div className="sync-panel" role="status"><h2>An option needs another look.</h2>
      <p>{unavailableCount} saved comparison {unavailableCount === 1 ? 'option is' : 'options are'} unavailable in the current directory. Your workspace notes are kept.</p>
      <button className="button secondary" onClick={() => change(options)}>Remove unavailable comparison options</button></div>}
    {options.length < 2 ? <><EmptyState title="A decision has more than one side.">Choose two or three course options in Explore or college details to see their differences here.</EmptyState>{selected.length === 1 && <div className="single-compare"><span>{selected[0].college.name} is ready to compare.</span><button className="icon-button" aria-label="Remove comparison option" onClick={() => change([])}><X size={17} /></button><Link className="text-link" to="/explore">Find a second option<ArrowRight size={15} /></Link></div>}</> : <>
      <div className="compare-toolbar"><div className="comparison-tabs" aria-label="Comparison sections">{['All details', 'Costs', 'Academics', 'Placements'].map(name => <button className={section === name ? 'active' : ''} aria-pressed={section === name} key={name} onClick={() => setSection(name)}>{name}</button>)}</div><button className="button secondary" onClick={copyLink}><Link2 size={15} />Copy link</button></div>
      <p className="compare-scroll-hint">Scroll sideways to see every option<ArrowRight size={14} /></p>
      <div className="comparison-scroll" tabIndex={0} role="region" aria-label="College comparison table; scroll horizontally for more options"><table className="comparison-table"><caption className="sr-only">Comparison of selected college and course options</caption><thead><tr><th scope="col"><p className="eyebrow">Your options</p><h2>The details<br />that matter.</h2><p>{selected.length} of 3 slots used</p>{selected.length < 3 && <Link className="text-link" to="/explore"><Plus size={14} />Add another</Link>}</th>{selected.map(({ college, course, option }, index) => <th scope="col" key={optionKey(option)}><div className="comparison-top"><span className="eyebrow">Option {String(index + 1).padStart(2, '0')}</span><button className="icon-button" aria-label={`Remove ${college.name} from compare`} onClick={() => change(options.filter((_, i) => i !== index))}><X size={17} /></button></div><Link to={`/colleges/${college.slug}`}><h3>{college.name}</h3></Link><p>{college.city}, {college.state}</p><label className="sr-only" htmlFor={`compare-course-${index}`}>Course for {college.name}</label><select id={`compare-course-${index}`} value={course?.id ?? ''} onChange={event => {
        const next = options.map((item, i) => i === index ? { ...item, courseId: event.target.value || null } : item);
        if (new Set(next.map(optionKey)).size !== next.length) { notify('This course option is already in your comparison.'); return; }
        change(next);
      }}><option value="">Choose a course</option>{college.courses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></th>)}</tr></thead>
      <tbody>{show('Costs') && <><tr className="table-section"><th scope="row">Costs</th>{selected.map(item => <td key={optionKey(item.option)} />)}</tr><tr><th scope="row">Annual tuition<small>Check the source and applicable category</small></th>{selected.map(item => <td key={optionKey(item.option)} className={item.course?.annualTuition === lowestTuition && lowestTuition !== null ? 'best-value' : ''}><strong>{item.course ? money(item.course.annualTuition) : 'Choose a course'}</strong>{item.course && <small>{tuitionLabel(item.course)}</small>}{item.course?.tuitionEvidence && <><small>{item.course.tuitionEvidence.notes}</small><a className="text-link" href={item.course.tuitionEvidence.source.url ?? undefined} target="_blank" rel="noopener noreferrer">Fee source · {item.course.tuitionEvidence.source.reportingYear}</a></>}{item.course?.annualTuition === lowestTuition && lowestTuition !== null && <small><Check size={12} />Lowest tuition within the same source scope</small>}</td>)}</tr><tr><th scope="row">Your full-course estimate<small>From saved workspace inputs</small></th>{selected.map(item => <td key={optionKey(item.option)} className={item.cost?.complete && item.cost.total === lowestCost ? 'best-value' : ''}>{item.cost ? <><strong>{money(item.cost.total)}</strong><small>{item.cost.complete ? 'All cost inputs included' : 'Partial · missing cost inputs'}</small>{item.cost.complete && item.cost.total === lowestCost && <small><Check size={12} />Lowest complete estimate</small>}</> : <Link className="text-link" to={`/colleges/${item.college.slug}${courseSection}`}>Plan costs<ArrowRight size={13} /></Link>}</td>)}</tr></>}
      {show('Academics') && <><tr className="table-section"><th scope="row">Academics & location</th>{selected.map(item => <td key={optionKey(item.option)} />)}</tr><tr><th scope="row">Qualification</th>{selected.map(item => <td key={optionKey(item.option)}>{item.course?.degree ?? 'Choose a course'}</td>)}</tr><tr><th scope="row">Course duration</th>{selected.map(item => <td key={optionKey(item.option)}>{item.course ? duration(item.course.durationMonths) : 'Choose a course'}</td>)}</tr><tr><th scope="row">Location</th>{selected.map(item => <td key={optionKey(item.option)}>{item.college.city}<small>{item.college.state}</small></td>)}</tr><tr><th scope="row">Facilities</th>{selected.map(item => <td key={optionKey(item.option)}>{item.college.facilities.length ? <ul className="table-facilities">{item.college.facilities.map(facility => <li key={facility}>{facility}</li>)}</ul> : "Not available"}</td>)}</tr></>}
      {show('Placements') && <><tr className="table-section"><th scope="row">Placements</th>{selected.map(item => <td key={optionKey(item.option)} />)}</tr>
        <tr><th scope="row">Median annual salary<small>Placed graduates in the stated cohort</small></th>{selected.map(item => <td key={optionKey(item.option)}>{money(item.college.placements.medianPackage ?? null)}{item.college.placements.source && <><small>{item.college.placements.scope} · {item.college.placements.reportingYear! - 1}–{String(item.college.placements.reportingYear).slice(-2)}</small><a className="text-link" href={item.college.placements.source.url ?? undefined} target="_blank" rel="noopener noreferrer">Official outcomes report</a></>}</td>)}</tr>
        <tr><th scope="row">Placed / graduated<small>Counts; not a job-seeker placement rate</small></th>{selected.map(item => <td key={optionKey(item.option)}>{item.college.placements.placed != null ? `${item.college.placements.placed} / ${item.college.placements.graduates}` : 'Not available'}<small>Graduated in minimum stipulated time</small></td>)}</tr>
        <tr><th scope="row">Selected for higher studies</th>{selected.map(item => <td key={optionKey(item.option)}>{item.college.placements.higherStudies ?? 'Not available'}</td>)}</tr></>}
      <tr className="table-section"><th scope="row">Your priorities</th>{selected.map(item => <td key={optionKey(item.option)} />)}</tr><tr><th scope="row">Why it may fit</th>{selected.map(item => <td key={optionKey(item.option)}>{item.reasons.length ? item.reasons.map(reason => <span className="match-reason" key={reason}><Check size={12} />{reason}</span>) : <Link className="text-link" to="/preferences">Set preferences<ArrowRight size={13} /></Link>}</td>)}</tr><tr><th scope="row">Your next step</th>{selected.map(item => <td key={optionKey(item.option)}><button className="button primary" onClick={() => addEntry(item.option)}><Bookmark size={15} />Add to workspace</button></td>)}</tr></tbody></table></div>
      <p className="fine-print comparison-note">Tuition highlights require matching source scope. Full-course estimates use your saved inputs. Outcomes cover the stated institution-wide cohort, rather than a specific course; a small placed population or different programme mix can make salary comparisons misleading.</p>
    </>}
  </div>;
}
