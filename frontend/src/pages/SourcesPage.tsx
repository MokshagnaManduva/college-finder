import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useCatalog } from '../state/CatalogProvider';
import { sourceCoverage } from '../domain/provenance';
import { SourceNote } from '../components/SourceNote';
import { CampusImage, PhotoCredit } from '../components/ui';
import { campusPhoto } from '../domain/photos';

export function SourcesPage() {
  const {colleges} = useCatalog();
  const coverage = sourceCoverage(colleges);
  const photographed = colleges.filter(college => campusPhoto(college.slug));
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
      <p>The catalog contains a selected set of programmes linked to official sources, rather than every course an institution offers. Each reviewed claim has its own retained evidence. Campus photographs identify their subject, creator and reuse license below. Unavailable tuition, seats, facilities and outcomes stay blank; they are never treated as zero.</p>
      <p>Tuition evidence states the admission year, fee category and conversion used. Semester tuition uses two semesters. Bundled academic or programme fees are not presented as tuition. Academic fees and admission payments are labelled separately below; admission payments are never annualized. Hostel, deposits, summer terms and fee increases need separate planning. NIRF outcomes show median annual salary for placed graduates in a named cohort, with the graduating academic year.</p>
    </div>
    <section className="source-context"><h2>Institution and outcome sources</h2><p>{coverage.profileCount} institution profiles have archived official documents; {coverage.outcomeCount} institutions include reported placement outcomes. Programme figures have their own evidence below.</p>
      <details className="source-review-details"><summary>Browse institution sources ({colleges.length})</summary><div className="source-course-list">{colleges.map(college => <article className="source-course" key={college.id}><h3>{college.name}</h3>
        {college.source?.url && <a className="text-link" href={college.source.url} target="_blank" rel="noopener noreferrer">{college.source.title}</a>}
        <p className="fine-print">{college.source?.notes}</p>
        {college.placements.source && <><a className="text-link" href={college.placements.source.url ?? undefined} target="_blank" rel="noopener noreferrer">{college.placements.source.title}</a><p className="fine-print">{college.placements.source.notes}</p></>}
        {(college.facilityEvidence ?? []).map(facility => <div key={facility.name}><a className="text-link" href={facility.source.url ?? undefined} target="_blank" rel="noopener noreferrer">{facility.name} · official evidence</a><p className="fine-print">{facility.scope}</p></div>)}<Link className="text-link" to={`/colleges/${college.slug}${section}`}>View programmes and evidence<ArrowRight size={15} /></Link>
      </article>)}</div></details>
    </section>
    <section className="source-context photo-sources" id="photos"><h2>Campus photography</h2>
      <p>{photographed.length} institutions have photographs of their named campuses or buildings. Photos come from Wikimedia Commons and retain their individual licenses. They may show an earlier campus appearance; they are not evidence of current facilities or an institutional endorsement. Wikimedia thumbnails are used where available and cropped to fit, without retouching.</p>
      <details className="source-review-details"><summary>Browse photo credits ({photographed.length})</summary>
        <div className="photo-source-grid">{photographed.map(college => <figure className="photo-source" key={college.id}>
          <CampusImage src={college.image} name={college.name} slug={college.slug} />
          <figcaption><h3>{college.name}</h3><p>{campusPhoto(college.slug)?.caption}</p><PhotoCredit slug={college.slug} /></figcaption>
        </figure>)}</div>
      </details>
    </section>
    <p className="fine-print">Additional evidence: {coverage.academicFeeCount} academic fee or admission payment claims, {coverage.intakeCount} reported intake claims and {coverage.facilityCount} campus facilities. Approved intake is not a count of available vacancies.</p><h2>Reviewed programme figures</h2>
    {coverage.reviewed.length === 0 ? <div className="empty-state"><h2>No reviewed course figures are available.</h2>
      <p>Use the institution links below to check programme and fee details.</p>
      <Link className="button primary" to="/explore">Explore the directory<ArrowRight size={16} /></Link></div>
      : <div className="source-course-list">{coverage.reviewed.map(({college, course, tuition, duration, academicFee, seats}) =>
        <article className="source-course" key={course.id}><p className="eyebrow">{college.name}</p><h2>{course.name}</h2>
          <Link className="text-link" to={`/colleges/${college.slug}${section}`} state={{courseId: course.id}}>View this course's data<ArrowRight size={15} /></Link>
          {course.source?.url && <details className="source-review-details"><summary>Programme documents and fee context</summary>
            <a className="text-link" href={course.source.url} target="_blank" rel="noopener noreferrer">{course.source.title}</a><p className="fine-print">{course.source.notes}</p>
          </details>}
          <div className="source-claim-grid">{tuition ? <SourceNote evidence={tuition} label="Tuition" /> : <p className="fine-print">Tuition has not been reviewed.</p>}
            {academicFee && <SourceNote evidence={academicFee} label={academicFee.rawUnit === "INR/admission" ? "Admission payment" : "Academic fee"} />}{seats && <SourceNote evidence={seats} label="Reported intake" />}{duration ? <SourceNote evidence={duration} label="Duration" /> : <p className="fine-print">Duration has not been reviewed.</p>}</div>
          <details className="source-review-details"><summary>Review details</summary>{[tuition, duration, academicFee, seats].flatMap((evidence, index) => evidence ?
            [<dl key={index}><div><dt>Claim</dt><dd>{['Tuition', 'Duration', 'Academic fee / admission payment', 'Reported intake'][index]}</dd></div><div><dt>Reviewer</dt><dd>{evidence.reviewer}</dd></div>
              <div><dt>Retained document SHA-256</dt><dd className="source-checksum">{evidence.documentSha256 ?? 'Not recorded'}</dd></div></dl>] : [])}</details>
        </article>)}</div>}
  </div>;
}
