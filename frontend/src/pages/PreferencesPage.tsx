import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, SlidersHorizontal } from 'lucide-react';
import { useCatalog } from '../state/CatalogProvider';
import { useGuest } from '../state/GuestProvider';
import { courseMatch } from '../domain/college';
import type { Preferences } from '../types';

export function PreferencesPage() {
  const { colleges: demoColleges, degrees, states } = useCatalog();
  const { state, setPreferences, notify } = useGuest();
  const [preferences, setDraft] = useState<Preferences>(state.preferences);
  const navigate = useNavigate();
  const set = (patch: Partial<Preferences>) => setDraft(current => ({ ...current, ...patch }));
  const hasPreferences = Boolean(preferences.degree || preferences.states.length || preferences.budget !== null);
  const options = demoColleges.flatMap(college => college.courses.flatMap(course => {
    const match = courseMatch(college, course, preferences);
    return match ? [{ college, course, ...match }] : [];
  })).sort((a, b) => b.score - a.score || a.college.name.localeCompare(b.college.name) || a.course.id.localeCompare(b.course.id));
  const submit = async (event: FormEvent) => { event.preventDefault(); if (await setPreferences(preferences)) { notify('Your preferences are saved.'); navigate('/explore'); } };
  return <div className="preferences-page"><div className="page-heading"><div><p className="eyebrow">Your priorities come first</p><h1>What matters to you?</h1><p>A few preferences. A clearer starting point. You can change these anytime.</p></div><SlidersHorizontal size={26} /></div>
    <div className="preferences-layout"><form className="preferences-form panel" onSubmit={submit}><div className="form-section"><span className="form-step">01</span><div><h2>What would you like to study?</h2><p>Choose a qualification, or keep your options open.</p><label>Degree or qualification<select value={preferences.degree} onChange={event => set({ degree: event.target.value })}><option value="">I'm still exploring</option>{degrees.map(degree => <option key={degree}>{degree}</option>)}</select></label></div></div>
      <div className="form-section"><span className="form-step">02</span><div><h2>Where do you see yourself?</h2><p>Select a few states. Leave these empty to explore anywhere.</p><fieldset className="state-options"><legend className="sr-only">Preferred states</legend>{states.map(stateName => <label className={preferences.states.includes(stateName) ? 'selected' : ''} key={stateName}><input type="checkbox" checked={preferences.states.includes(stateName)} onChange={event => set({ states: event.target.checked ? [...preferences.states, stateName] : preferences.states.filter(item => item !== stateName) })} />{stateName}</label>)}</fieldset><label className="check-label"><input type="checkbox" checked={preferences.strictLocation} onChange={event => set({ strictLocation: event.target.checked })} />Only show these states</label></div></div>
      <div className="form-section"><span className="form-step">03</span><div><h2>What is your tuition budget?</h2><p>Annual tuition only. Living and other costs can be planned separately.</p><label>Annual tuition budget (INR)<div className="money-input"><span>₹</span><input type="number" min="0" max="1000000000" step="1" placeholder="No budget set" value={preferences.budget ?? ''} onChange={event => {
        const value = event.target.value === '' ? null : Number(event.target.value);
        if (value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 1000000000)) set({ budget: value });
      }} /></div></label><label className="check-label"><input type="checkbox" checked={preferences.strictBudget} onChange={event => set({ strictBudget: event.target.checked })} />Only show options within this budget</label></div></div>
      <div className="form-footer"><Link className="text-link" to="/explore">Skip for now</Link><button className="button primary" type="submit">Save & explore<ArrowRight size={16} /></button></div>
    </form><aside className="preferences-preview"><p className="eyebrow">A little more focus</p><h2>Your preferences,<br />in practice.</h2><p>We'll explain why an option fits, so you can decide what deserves a closer look.</p>
      {hasPreferences && options[0] ? <div className="match-preview"><span className="demo-tag">Preference match</span><h3>{options[0].college.name}</h3><p>{options[0].course.name}</p>{options[0].reasons.map(reason => <span className="match-reason" key={reason}><Check size={14} />{reason}</span>)}{options[0].mismatches.map(reason => <span className="muted" key={reason}>{reason}</span>)}</div> : <div className="match-preview"><h3>{hasPreferences ? 'Give your options a little more room.' : 'Your options are open.'}</h3><p>{hasPreferences ? 'No options meet your requirements. Try a different degree or broaden your location and budget.' : 'Choose a preference to see a matching example here.'}</p></div>}
      <div className="preference-coverage"><strong>{options.length}</strong><span>course options{hasPreferences ? ' meet your requirements' : ' to explore'}</span></div><p className="fine-print">These matches reflect your preferences and the published catalogue. Admission eligibility needs separate research.</p>
    </aside></div>
  </div>;
}

