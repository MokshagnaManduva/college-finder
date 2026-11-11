import { useState } from 'react';
import { Bookmark, Calculator } from 'lucide-react';
import type { College, Course, CostScenario } from '../types';
import { duration, estimateCost, money } from '../domain/college';
import { useGuest } from '../state/GuestProvider';
import { annualAcademicFee, displayedFee, reviewedEvidence, tuitionLabel } from '../domain/provenance';
import { SourceNote } from './SourceNote';

export function CostCalculator({ college, course }: { college: College; course: Course }) {
  const { state, addEntry } = useGuest();
  const saved = state.entries.find(entry => entry.collegeId === college.id && entry.courseId === course.id);
  const academic = reviewedEvidence(course, 'academicFee');
  const useAcademic = course.annualTuition === null && annualAcademicFee(course) !== null;
  const [scenario, setScenario] = useState<CostScenario>(saved?.scenario ?? { tuition: course.annualTuition ?? annualAcademicFee(course), living: null, other: null, oneTime: null });
  const [tuitionEdited, setTuitionEdited] = useState(Boolean(saved?.scenario));
  const result = estimateCost(scenario, course.durationMonths);
  const inputs = [
    { key: 'tuition' as const, label: useAcademic ? 'Annual academic fee' : 'Annual tuition', hint: tuitionEdited ? 'Your estimate' : useAcademic ? displayedFee(course).label : tuitionLabel(course) },
    { key: 'living' as const, label: 'Annual living / hostel costs', hint: 'Your estimate' },
    { key: 'other' as const, label: 'Other annual costs', hint: 'Required academic charges, books, travel' },
    { key: 'oneTime' as const, label: 'One-time costs', hint: 'Your estimate' },
  ];
  const hasAny = Object.values(scenario).some(value => value !== null);
  return <div className="cost-calculator"><div className="cost-heading"><Calculator size={21} /><div><h3>See the bigger cost picture.</h3><p>Plan for {duration(course.durationMonths)} of {course.degree}.</p></div></div>
    <div className="cost-fields">{inputs.map(({ key, label, hint }) => <label key={key}>{label}<div className="money-input"><span>₹</span><input type="number" min="0" max="1000000000" step="1" value={scenario[key] ?? ''} placeholder="Not entered" onChange={event => {
      const number = event.target.value === '' ? null : Number(event.target.value);
      if (number !== null && (!Number.isSafeInteger(number) || number < 0 || number > 1000000000)) return;
      setScenario(current => ({ ...current, [key]: number }));
      if (key === 'tuition') setTuitionEdited(true);
    }} /></div><small>{hint}</small></label>)}</div>
    <div className="cost-total"><span>{result.complete ? 'Estimated full-course cost' : 'Partial course estimate'}</span><strong>{hasAny ? money(result.total) : 'Add your estimates'}</strong><p>{result.complete ? 'All four cost inputs included.' : 'Enter missing costs, or 0 when there is no cost.'}</p></div>
    <p className="fine-print">This is a planning estimate, not the institution's total payable fee. Assumes constant annual costs, even when a source publishes later-year increases. Add charges excluded from the stated fee, hostel, deposits and any summer or Practice School fees separately. Do not count charges already included in an academic fee twice. Adjust fees for your category, scholarships and remissions.</p>
    {!reviewedEvidence(course, 'duration') && <p className="fine-print">Programme duration has not been source checked. Confirm it before relying on this estimate.</p>}
    {course.tuitionEvidence && <SourceNote evidence={course.tuitionEvidence} label="Tuition" />}
    {academic && <SourceNote evidence={academic} label={academic.rawUnit === 'INR/admission' ? 'Admission payment (not used as annual tuition)' : 'Academic fee'} />}
    <button className="button primary" onClick={() => addEntry({ collegeId: college.id, courseId: course.id }, scenario)}><Bookmark size={16} />Save this option & estimate</button>
  </div>;
}
