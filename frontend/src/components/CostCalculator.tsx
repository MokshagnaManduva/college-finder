import { useState } from 'react';
import { Bookmark, Calculator } from 'lucide-react';
import type { College, Course, CostScenario } from '../types';
import { estimateCost, money } from '../domain/college';
import { useGuest } from '../state/GuestProvider';
import { tuitionLabel } from '../domain/provenance';
import { SourceNote } from './SourceNote';

export function CostCalculator({ college, course }: { college: College; course: Course }) {
  const { state, addEntry } = useGuest();
  const saved = state.entries.find(entry => entry.collegeId === college.id && entry.courseId === course.id);
  const [scenario, setScenario] = useState<CostScenario>(saved?.scenario ?? { tuition: course.annualTuition, living: null, other: null, oneTime: null });
  const [tuitionEdited, setTuitionEdited] = useState(Boolean(saved?.scenario));
  const result = estimateCost(scenario, course.durationMonths);
  const inputs = [
    { key: 'tuition' as const, label: 'Annual tuition', hint: tuitionEdited ? 'Your estimate' : tuitionLabel(course) },
    { key: 'living' as const, label: 'Annual living / hostel costs', hint: 'Your estimate' },
    { key: 'other' as const, label: 'Other annual costs', hint: 'Books, travel, or other costs' },
    { key: 'oneTime' as const, label: 'One-time costs', hint: 'Your estimate' },
  ];
  const hasAny = Object.values(scenario).some(value => value !== null);
  return <div className="cost-calculator"><div className="cost-heading"><Calculator size={21} /><div><h3>See the bigger cost picture.</h3><p>Plan for {course.durationMonths / 12} years of {course.degree}.</p></div></div>
    <div className="cost-fields">{inputs.map(({ key, label, hint }) => <label key={key}>{label}<div className="money-input"><span>₹</span><input type="number" min="0" max="1000000000" step="1" value={scenario[key] ?? ''} placeholder="Not entered" onChange={event => {
      const number = event.target.value === '' ? null : Number(event.target.value);
      if (number !== null && (!Number.isSafeInteger(number) || number < 0 || number > 1000000000)) return;
      setScenario(current => ({ ...current, [key]: number }));
      if (key === 'tuition') setTuitionEdited(true);
    }} /></div><small>{hint}</small></label>)}</div>
    <div className="cost-total"><span>{result.complete ? 'Estimated full-course cost' : 'Partial course estimate'}</span><strong>{hasAny ? money(result.total) : 'Add your estimates'}</strong><p>{result.complete ? 'All four cost inputs included.' : 'Enter missing costs, or 0 when there is no cost.'}</p></div>
    <p className="fine-print">Assumes constant annual costs. Scholarships, remissions and fee increases are excluded. Adjust tuition to your applicable fee category before planning.</p>
    {course.tuitionEvidence && <SourceNote evidence={course.tuitionEvidence} label="Tuition" />}
    <button className="button primary" onClick={() => addEntry({ collegeId: college.id, courseId: course.id }, scenario)}><Bookmark size={16} />Save this option & estimate</button>
  </div>;
}
