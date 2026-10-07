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
    <p>See which course figures have been checked and which still need research.</p>
  </div><BookOpen size={26} /></div>
    <div className="workspace-stats source-stats">
      <div><span>Tuition claims reviewed</span><strong>{coverage.tuitionCount}<small>of {coverage.courseCount} courses</small></strong></div>
      <div><span>Duration claims reviewed</span><strong>{coverage.durationCount}<small>of {coverage.courseCount} courses</small></strong></div>
      <div><span>Courses with reviewed claims</span><strong>{coverage.reviewed.length}</strong></div>
      <div><span>Retained source documents</span><strong>{coverage.documentCount}</strong></div>
    </div>
    <div className="source-context"><h2>A reviewed figure has a specific scope.</h2>
      <p>Source checked means the cited claim was reviewed against an official document. It does not verify every fact about the college. Overview, seats, facilities and placement figures in this directory remain demo data.</p>
      <p>Annualized tuition uses two semesters at the reported rate. Your fee category, remissions and future fee changes can affect what you pay.</p>
    </div>
    {coverage.reviewed.length === 0 ? <div className="empty-state"><h2>Course review is still ahead.</h2>
      <p>This directory currently uses demo fixtures. Check official institution sources before relying on its figures.</p>
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
