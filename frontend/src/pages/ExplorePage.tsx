import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { collegesApi, PAGE_SIZE, matchingCourses } from '../api';
import { useCatalog } from '../state/CatalogProvider';
import type { ExploreQuery } from '../types';
import { money, courseMatch } from '../domain/college';
import { useGuest } from '../state/GuestProvider';
import { CollegeRow } from '../components/CollegeRow';
import { LoadingRows, Modal } from '../components/ui';

function SearchField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = value;
    if (timer.current) clearTimeout(timer.current);
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <div className="search-field"><Search size={18} /><input ref={ref} type="search" defaultValue={value}
    aria-label="Search colleges, courses or places" placeholder="Search a college, course, or place"
    onChange={event => {
      const next = event.target.value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(next), 300);
    }} /></div>;
}

function Filters({ query, update }: { query: ExploreQuery; update(values: Record<string, string>): void }) {
  const { degrees, states } = useCatalog();
  return <div className="filter-fields">
    <label>Degree or qualification<select value={query.degree} onChange={event => update({ degree: event.target.value })}><option value="">All degrees</option>{degrees.map(degree => <option key={degree}>{degree}</option>)}</select></label>
    <label>Where you want to study<select value={query.state} onChange={event => update({ state: event.target.value })}><option value="">Anywhere in India</option>{states.map(state => <option key={state}>{state}</option>)}</select></label>
    <label>Annual tuition budget<select value={query.budget ?? ''} onChange={event => update({ budget: event.target.value })}><option value="">Any tuition</option>{[50000, 100000, 250000, 500000, 1000000, 2500000].map(budget => <option value={budget} key={budget}>Up to {money(budget)}</option>)}</select></label>
    <p className="filter-hint">Budget applies to a matching course. Check each course’s fee source and applicable category.</p>
  </div>;
}

export function ExplorePage() {
  const { degrees, states } = useCatalog();
  const [params, setParams] = useSearchParams();
  const { state } = useGuest();
  const [draft, setDraft] = useState<ExploreQuery | null>(null);
  const hasPreferences = Boolean(state.preferences.degree || state.preferences.states.length || state.preferences.budget !== null);
  const [personal, setPersonal] = useState(hasPreferences);
  const budgetValue = params.get('budget');
  const budget = budgetValue && Number.isSafeInteger(Number(budgetValue)) && Number(budgetValue) >= 0 ? Number(budgetValue) : null;
  const sortValue = params.get('sort');
  const query: ExploreQuery = {
    search: params.get('search') ?? '', state: states.includes(params.get('state') ?? '') ? params.get('state')! : '',
    degree: degrees.includes(params.get('degree') ?? '') ? params.get('degree')! : '', budget,
    sort: sortValue === 'tuition' || sortValue === 'established' ? sortValue : 'name',
    page: Math.max(1, Math.floor(Number(params.get('page')) || 1)),
  };
  // Explicit filters override the corresponding preference defaults.
  const preferences = personal && hasPreferences ? {
    ...state.preferences,
    degree: query.degree ? '' : state.preferences.degree,
    states: query.state ? [] : state.preferences.states,
    budget: query.budget !== null ? null : state.preferences.budget,
  } : null;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['colleges', query, preferences], queryFn: () => collegesApi.list(query, preferences),
  });
  const update = (values: Record<string, string>) => setParams(current => {
    const next = new URLSearchParams(current);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if (!('page' in values)) next.delete('page');
    return next;
  }, { replace: !('page' in values) });
  const clear = () => { setParams({}); setPersonal(false); };
  const active = [
    ...(query.search ? [{ key: 'search', label: `“${query.search}”` }] : []),
    ...(query.degree ? [{ key: 'degree', label: query.degree }] : []),
    ...(query.state ? [{ key: 'state', label: query.state }] : []),
    ...(query.budget !== null ? [{ key: 'budget', label: `Up to ${money(query.budget)}/yr` }] : []),
  ];
  return <div className="explore-page"><div className="page-heading"><div><p className="eyebrow">Find your direction</p><h1>A world of possibilities.</h1><p>Start wide. Narrow it down to what matters to you.</p></div><span className="page-stamp">Explore / 01</span></div>
    <div className="explore-layout"><aside className="filter-rail"><div className="filter-heading"><h2>Make it yours</h2><SlidersHorizontal size={18} /></div><Filters query={query} update={update} />
      <div className="filter-personal"><p className="eyebrow">A more personal search</p><h3>What does your next chapter look like?</h3><p>A few preferences can bring the right options into focus.</p><Link to="/preferences" className="text-link">Set your preferences<ArrowRight size={15} /></Link></div>
    </aside><section className="explore-results" aria-label="College results"><SearchField value={query.search} onChange={value => update({ search: value })} />
      <div className="results-toolbar"><p aria-live="polite"><strong>{data?.total ?? '…'}</strong> colleges<span>Worth a closer look.</span></p>
        <div><button className="button secondary mobile-filter-button" onClick={event => { event.currentTarget.focus(); setDraft(query); }}><SlidersHorizontal size={16} />Filters{active.length > 0 && ` (${active.length})`}</button>
          <label className="sort-label">Sort by<select aria-label="Sort colleges" value={query.sort} onChange={event => update({ sort: event.target.value })}><option value="name">College name</option><option value="tuition">Lowest tuition</option><option value="established">Established first</option></select></label></div>
      </div>
      {hasPreferences && <label className="preference-switch"><input type="checkbox" checked={personal} onChange={event => { setPersonal(event.target.checked); update({}); }} /><span>Use my preferences</span><Link to="/preferences">Edit</Link></label>}
      {active.length > 0 && <div className="active-filters">{active.map(filter => <button key={filter.key} onClick={() => update({ [filter.key]: '' })}>{filter.label}<X size={13} aria-label={`Remove ${filter.label}`} /></button>)}<button className="clear-filters" onClick={clear}>Clear all</button></div>}
      {isPending ? <LoadingRows /> : isError ? <div className="empty-state"><h2>We couldn't load these options.</h2><button className="button primary" onClick={() => refetch()}>Try again</button></div> : data?.total === 0 ? <div className="empty-state"><Search size={30} /><h2>A little more room to explore?</h2><p>No courses meet these filters. Try another degree, raise your budget, or broaden the location.</p><button className="button primary" onClick={clear}>Reset filters</button></div> : <>
        <div className="college-list">{data?.data.map((college, index) => {
          const courses = matchingCourses(college, query, preferences);
          const matched = preferences ? [...courses].sort((a, b) => (courseMatch(college, b, preferences)?.score ?? 0) - (courseMatch(college, a, preferences)?.score ?? 0))[0] : null;
          return <CollegeRow key={college.id} college={college} courses={courses} index={((data?.page ?? 1) - 1) * PAGE_SIZE + index} reasons={matched && preferences ? courseMatch(college, matched, preferences)?.reasons : []} />;
        })}</div>
        {data && data.totalPages > 1 && <nav className="pagination" aria-label="Result pages"><button className="button secondary" disabled={data.page === 1} onClick={() => update({ page: String(data.page - 1) })}><ArrowLeft size={15} />Previous</button><span>Page {data.page} of {data.totalPages}</span><button className="button secondary" disabled={data.page === data.totalPages} onClick={() => update({ page: String(data.page + 1) })}>Next<ArrowRight size={15} /></button></nav>}
      </>}
      <p className="results-footnote">A starting point for your research. Confirm fees and course details with each institution.</p>
    </section></div>
    {draft && <Modal title="Make it yours" onClose={() => setDraft(null)}><Filters query={draft} update={values => setDraft(current => current ? {
      ...current, ...(values.degree !== undefined ? { degree: values.degree } : {}),
      ...(values.state !== undefined ? { state: values.state } : {}),
      ...(values.budget !== undefined ? { budget: values.budget ? Number(values.budget) : null } : {}),
    } : null)} /><div className="modal-actions"><button className="button secondary" onClick={() => setDraft({ ...draft, degree: '', state: '', budget: null })}>Reset</button><button className="button primary" onClick={() => { update({ degree: draft.degree, state: draft.state, budget: draft.budget === null ? '' : String(draft.budget) }); setDraft(null); }}>Apply filters</button></div></Modal>}
  </div>;
}
