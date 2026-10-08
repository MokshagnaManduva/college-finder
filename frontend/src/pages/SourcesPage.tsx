import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useCatalog } from '../state/CatalogProvider';
import { sourceCoverage } from '../domain/provenance';
import { SourceNote } from '../components/SourceNote';

export function SourcesPage() {
  const {colleges} = useCatalog();
  const coverage = sourceCoverage(colleges);
  const section = window.location.protocol === 'file:' ? '?section=sources' : '#sources';
  return <div className="sources-page"><div className="page-heading"><div>
    <p className="eyebrow">Know what you're looking at</p><h1>The facts, with their sources.</h1>
    <p>Trace institution profiles, programme structure, tuition and outcomes to their official sources.</p>
  </div><BookOpen size={26} /></div>
    <div className="workspace-stats source-stats">
      <div><span>Tuition claims reviewed</span><strong>{coverage.tuitionCount}<small>of {coverage.courseCount} courses</small></strong></div>
      <div><span>Duration claims reviewed</span><strong>{coverage.durationCount}<small>of {coverage.courseCount} courses</small></strong></div>
      <div><span>Courses with reviewed claims</span><strong>{coverage.reviewed.length}</strong></div>
      <div><span>Retained source documents</span><strong>{coverage.documentCount}</strong></div>
    </div>
    <div className="source-context"><h2>Each source answers a particular question.</h2>
      <p>The catalog contains a selected set of confirmed programmes, rather than every course an institution offers. Sample figures and campus photographs have been removed. Unavailable tuition, seats, facilities and outcomes stay blank; they are never treated as zero.</p>
      <p>Tuition evidence states the admission year, fee category and conversion used. Semester fees use two semesters; SIBM academic fees use two instalments per year. Hostel, deposits, summer terms and fee increases need separate planning. NIRF outcomes show median annual salary for placed graduates in a named cohort, with the graduating academic year.</p>
    </div>
    <section className="source-context"><h2>Institution and outcome sources</h2><p>{coverage.profileCount} institution profiles have archived official documents; {coverage.outcomeCount} institutions include reported placement outcomes. Programme figures have their own evidence below.</p>
      <details className="source-review-details"><summary>Browse institution sources ({colleges.length})</summary><div className="source-course-list">{colleges.map(college => <article className="source-course" key={college.id}><h3>{college.name}</h3>
        {college.source?.url && <a className="text-link" href={college.source.url} target="_blank" rel="noopener noreferrer">{college.source.title}</a>}
        <p className="fine-print">{college.source?.notes}</p>
        {college.placements.source && <><a className="text-link" href={college.placements.source.url ?? undefined} target="_blank" rel="noopener noreferrer">{college.placements.source.title}</a><p className="fine-print">{college.placements.source.notes}</p></>}
        <Link className="text-link" to={`/colleges/${college.slug}${section}`}>View programmes and evidence<ArrowRight size={15} /></Link>
      </article>)}</div></details>
    </section>
    <h2>Reviewed programme figures</h2>
    {coverage.reviewed.length === 0 ? <div className="empty-state"><h2>No reviewed course figures are available.</h2>
      <p>Use the institution links below to check programme and fee details.</p>
      <Link className="button primary" to="/explore">Explore the directory<ArrowRight size={16} /></Link></div>
      : <div className="source-course-list">{coverage.reviewed.map(({college, course, tuition, duration}) =>
        <article className="source-course" key={course.id}><p className="eyebrow">{college.name}</p><h2>{course.name}</h2>
          <Link className="text-link" to={`/colleges/${college.slug}${section}`} state={{courseId: course.id}}>View this course's data<ArrowRight size={15} /></Link>
          <div className="source-claim-grid">{tuition ? <SourceNote evidence={tuition} label="Tuition" /> : <p className="fine-print">Tuition has not been reviewed.</p>}
            {duration ? <SourceNote evidence={duration} label="Duration" /> : <p className="fine-print">Duration has not been reviewed.</p>}</div>
          <details className="source-review-details"><summary>Review details</summary>{[tuition, duration].flatMap((evidence, index) => evidence ?
            [<dl key={index}><div><dt>Claim</dt><dd>{index === 0 ? 'Tuition' : 'Duration'}</dd></div><div><dt>Reviewer</dt><dd>{evidence.reviewer}</dd></div>
              <div><dt>Retained document SHA-256</dt><dd className="source-checksum">{evidence.documentSha256 ?? 'Not recorded'}</dd></div></dl>] : [])}</details>
        </article>)}</div>}
  </div>;
}
