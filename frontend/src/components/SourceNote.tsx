import type { CourseEvidence } from '../types';
import { money } from '../domain/college';

export function SourceNote({evidence, label}: {evidence: CourseEvidence; label: string}) {
  return <div className="source-fact"><strong>{label} · source checked</strong>
    <p>{evidence.rawUnit.startsWith('INR/') ? `Reported: ${money(evidence.rawValue)} per ${evidence.rawUnit.split('/')[1]}${evidence.factor > 1 ? ' · Annualized using two semesters' : ''}` : `Reported duration: ${evidence.rawValue} ${evidence.rawUnit}`}</p>
    <p>{evidence.notes}</p><a className="text-link" href={evidence.source.url ?? undefined}
      target="_blank" rel="noopener noreferrer">{evidence.source.title}</a>
    <small>Reporting year: {evidence.source.reportingYear ?? 'not specified'} · Reviewed {evidence.reviewedAt.slice(0, 10)}</small>
  </div>;
}
