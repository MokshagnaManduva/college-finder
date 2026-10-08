import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDownToLine, Bookmark, CalendarDays, LayoutGrid, List, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCatalog } from '../state/CatalogProvider';
import { useAuth } from '../state/AuthProvider';
import { useGuest } from '../state/GuestProvider';
import { STAGES, type Stage, type WorkspaceEntry } from '../types';
import { compactMoney, csvCell, dateStatus, estimateCost } from '../domain/college';
import { EmptyState, Modal } from '../components/ui';

function EntryCard({ entry, edit, board = false }: { entry: WorkspaceEntry; edit(entry: WorkspaceEntry): void; board?: boolean }) {
  const { updateEntry } = useGuest();
  const { colleges: demoColleges } = useCatalog();
  const college = demoColleges.find(item => item.id === entry.collegeId);
  if (!college) return <article className="workspace-card"><h3>College not in the current directory</h3>
    <p className="fine-print">Your notes are kept. Export a backup to move this option to the appropriate directory.</p>
    <p className="entry-notes">{entry.notes}</p><button className="text-link" onClick={event => { event.currentTarget.focus(); edit(entry); }}>Edit notes</button></article>;
  const course = college.courses.find(item => item.id === entry.courseId);
  const target = dateStatus(entry.targetDate);
  const cost = entry.scenario && course ? estimateCost(entry.scenario, course.durationMonths) : null;
  return <article className={`workspace-card ${board ? 'board-card' : ''}`} draggable={board}
    onDragStart={event => { event.dataTransfer.setData('text/plain', entry.id); event.dataTransfer.effectAllowed = 'move'; }}>
    <div className="entry-title"><span className="entry-mark"><Bookmark size={18} /></span><div><Link to={`/colleges/${college.slug}`}><h3>{college.name}</h3></Link><p>{course?.name ?? (entry.courseId ? 'Programme archived · your notes are kept' : 'College research · select a course in details')}</p><small>{college.city}, {college.state}</small></div><button className="icon-button" aria-label={`Edit ${college.name}`} onClick={event => { event.currentTarget.focus(); edit(entry); }}><Pencil size={16} /></button></div>
    {entry.nextAction && <p className="entry-next"><ArrowRight size={14} /><span>{entry.nextAction}</span></p>}
    {entry.notes && <p className="entry-notes">{entry.notes}</p>}
    <div className="entry-footer"><label><span className="sr-only">Stage for {college.name}</span><select value={entry.stage} onChange={event => updateEntry(entry.id, { stage: event.target.value as Stage })}>{STAGES.map(stage => <option key={stage}>{stage}</option>)}</select></label>
      {entry.targetDate && <span className={`target-date ${target ?? ''}`}><CalendarDays size={13} />{target === 'overdue' ? 'Overdue · ' : target === 'soon' ? 'Soon · ' : ''}{new Date(`${entry.targetDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
      {cost && <span className="entry-cost">{compactMoney(cost.total)}<small>{cost.complete ? 'course estimate' : 'partial estimate'}</small></span>}
    </div>
  </article>;
}

export function WorkspacePage() {
  const { colleges: demoColleges } = useCatalog();
  const { user } = useAuth();
  const { state, updateEntry, removeEntry, notify, saving, conflicts, preferenceConflict,
    resolveImport, resolvePreferences, editConflicts, importBackup, recoveryAvailable, recoveryBackup, syncError, retrySync } = useGuest();
  const [view, setView] = useState<'list' | 'board'>('list');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<WorkspaceEntry | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const activeEntries = state.entries.filter(entry => !['Rejected', 'Withdrawn', 'Offer received'].includes(entry.stage));
  const upcoming = activeEntries.filter(entry => dateStatus(entry.targetDate) !== null).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const entries = filter ? state.entries.filter(entry => entry.stage === filter) : state.entries;
  const openEdit = (entry: WorkspaceEntry) => { setEditing({ ...entry }); setConfirmRemove(false); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!await updateEntry(editing.id, { notes: editing.notes.trim(), nextAction: editing.nextAction.trim(), targetDate: editing.targetDate, stage: editing.stage, revision: editing.revision })) return;
    notify('Your notes and next steps are saved.'); setEditing(null);
  };
  const exportList = () => {
    const rows = [['College', 'Course', 'Stage', 'Next action', 'Personal target date', 'Notes']];
    state.entries.forEach(entry => {
      const college = demoColleges.find(item => item.id === entry.collegeId);
      const course = college?.courses.find(item => item.id === entry.courseId);
      rows.push([college?.name ?? entry.collegeId, course?.name ?? '', entry.stage, entry.nextAction, entry.targetDate, entry.notes]);
    });
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'my-college-workspace.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const mainStages: Stage[] = ['Researching', 'Shortlisted', 'Applying', 'Applied'];
  const otherStages = STAGES.filter(stage => !mainStages.includes(stage) && entries.some(entry => entry.stage === stage));
  return <div className="workspace-page"><div className="page-heading"><div><p className="eyebrow">Your next chapter, taking shape</p><h1>A little closer to your decision.</h1><p>One place for your options, your thoughts, and your next moves.</p></div><Link className="button primary" to="/explore"><Plus size={16} />Find another option</Link></div>
    <div className="workspace-stats"><div><span>Your options</span><strong>{state.entries.length}<Bookmark size={19} /></strong></div><div><span>Shortlisted</span><strong>{state.entries.filter(entry => entry.stage === 'Shortlisted').length}<span className="stat-dot green" /></strong></div><div><span>Applications sent</span><strong>{state.entries.filter(entry => ['Applied', 'Offer received', 'Waitlisted', 'Rejected'].includes(entry.stage)).length}<span className="stat-dot clay" /></strong></div><div><span>Targets to check</span><strong>{upcoming.length}<CalendarDays size={19} /></strong></div></div>
    <div className="workspace-local"><span className="local-dot" /><span>{user ? (saving ? 'Saving to your account…' : 'Your account workspace · changes sync across devices') : 'Your guest workspace · saved on this browser'}</span>{!user && <Link to="/login" state={{ from: '/workspace' }}>Sign in to sync<ArrowRight size={13} /></Link>}</div>
    <div className="backup-actions"><button className="text-link" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'college-finder-workspace.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}><ArrowDownToLine size={14} />Export backup</button><label className="text-link backup-import">Import backup<input type="file" aria-label="Import workspace backup" accept=".json,application/json" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      if (file.size > 2_000_000) { notify('Choose a workspace backup smaller than 2 MB.'); return; }
      try { await importBackup(JSON.parse(await file.text())); } catch { notify('This backup could not be read. Choose a College Finder JSON backup.'); }
    }} /></label>{recoveryAvailable && <button className="text-link" onClick={() => {
      const recovery = recoveryBackup();
      if (!recovery) { notify('No readable recovery copy is available.'); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(recovery, null, 2)], {type: 'application/json'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'college-finder-browser-recovery.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export browser recovery</button>}<span>Keep a JSON backup of your notes and plans. Backups can be restored in another browser. Review saved tuition estimates against current programme sources.</span></div>
    {syncError && <div className="sync-panel" role="alert"><h3>Some browser options still need to sync.</h3>
      <p>{syncError} Your browser notes remain saved and can be exported.</p>
      <button className="button primary" onClick={() => void retrySync()}>Retry sync</button></div>}
    {preferenceConflict && <div className="sync-panel"><h3>Your browser preferences differ from your account.</h3><p>Your account preferences are active. Choose which version to keep.</p><button className="button secondary" onClick={() => void resolvePreferences(false)}>Keep account preferences</button><button className="button primary" onClick={() => void resolvePreferences(true)}>Use browser preferences</button></div>}
    {conflicts.map(conflict => <div className="sync-panel" key={conflict.clientId}><h3>Two versions of an option.</h3><p>{demoColleges.find(college => college.id === conflict.account.collegeId)?.name}</p><div className="sync-versions"><div><strong>Browser version</strong><p>{conflict.guest.notes || 'No notes'}</p><small>{conflict.guest.stage} · {conflict.guest.nextAction || 'No next action'}</small></div><div><strong>Account version</strong><p>{conflict.account.notes || 'No notes'}</p><small>{conflict.account.stage} · {conflict.account.nextAction || 'No next action'}</small></div></div><button className="button secondary" onClick={() => void resolveImport(conflict.clientId, false)}>Keep account version</button><button className="button primary" onClick={() => void resolveImport(conflict.clientId, true)}>Use browser version</button></div>)}
    {upcoming.length > 0 && <div className="upcoming-strip"><CalendarDays size={19} /><div><strong>{dateStatus(upcoming[0].targetDate) === 'overdue' ? 'A personal target needs a look.' : 'Your next step is coming up.'}</strong><span>{upcoming[0].nextAction || demoColleges.find(college => college.id === upcoming[0].collegeId)?.name} · {upcoming[0].targetDate}</span></div><button className="text-link" onClick={event => { event.currentTarget.focus(); openEdit(upcoming[0]); }}>Review<ArrowRight size={14} /></button></div>}
    {state.entries.length === 0 ? <EmptyState title="Your shortlist starts with a possibility.">When a college catches your eye, add it here. Your notes, cost estimates, and application steps will have a place to live.</EmptyState> : <>
      <div className="workspace-toolbar"><div><h2>Your options</h2><label className="sr-only" htmlFor="stage-filter">Filter workspace by stage</label><select id="stage-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="">All stages</option>{STAGES.map(stage => <option key={stage}>{stage}</option>)}</select></div><div><div className="segmented"><button aria-label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={17} /></button><button aria-label="Board view" aria-pressed={view === 'board'} className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><LayoutGrid size={17} /></button></div><button className="button secondary" onClick={exportList}><ArrowDownToLine size={15} /><span>Export CSV</span></button></div></div>
      {entries.length === 0 ? <div className="empty-state compact"><h2>No options in this stage yet.</h2><button className="button secondary" onClick={() => setFilter('')}>Show all options</button></div> : view === 'list' ? <div className="workspace-list">{entries.map(entry => <EntryCard key={entry.id} entry={entry} edit={openEdit} />)}</div> : <><p className="fine-print">Move an option with its stage menu, or drag it into another column.</p><div className="workspace-board" tabIndex={0} role="region" aria-label="Application stages; scroll horizontally to see more stages">{[...mainStages, ...otherStages].map(stage => <section className="board-column" key={stage} aria-label={`${stage} options`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (state.entries.some(entry => entry.id === id)) updateEntry(id, { stage }); }}><h3><span className={`stage-dot ${stage.toLowerCase().replace(' ', '-')}`} />{stage}<span>{entries.filter(entry => entry.stage === stage).length}</span></h3>{entries.filter(entry => entry.stage === stage).map(entry => <EntryCard key={entry.id} entry={entry} edit={openEdit} board />)}{!entries.some(entry => entry.stage === stage) && <p className="board-empty">Room for your next move.</p>}</section>)}</div></>}
    </>}
    {editing && <Modal title="Your notes & next steps" onClose={() => setEditing(null)}><form onSubmit={save} className="entry-editor">{editConflicts[editing.id] && <div className="sync-panel">
        <h3>A newer version needs a look.</h3><p>Your draft is still here. The account version says:</p>
        <blockquote>{editConflicts[editing.id].notes || 'No notes'}<br />{editConflicts[editing.id].nextAction}</blockquote>
        <button className="button secondary" type="button" onClick={() => setEditing({...editConflicts[editing.id]})}>Load latest version</button>
        <button className="button secondary" type="button" onClick={() => setEditing({...editing, revision: editConflicts[editing.id].revision})}>Keep my draft for the next save</button>
      </div>}<p className="editor-college">{demoColleges.find(college => college.id === editing.collegeId)?.name}</p><label>Application stage<select value={editing.stage} onChange={event => setEditing({ ...editing, stage: event.target.value as Stage })}>{STAGES.map(stage => <option key={stage}>{stage}</option>)}</select></label><label>Your next action<input placeholder="e.g. Check the course eligibility" maxLength={300} value={editing.nextAction} onChange={event => setEditing({ ...editing, nextAction: event.target.value })} /></label><label>Personal target date<input type="date" value={editing.targetDate} onChange={event => setEditing({ ...editing, targetDate: event.target.value })} /><small>A target you set, rather than a verified admissions deadline.</small></label><label>Private notes<textarea rows={4} maxLength={4000} placeholder="What stands out? What do you still want to ask?" value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} /></label>
      {confirmRemove ? <div className="remove-confirm"><p>Remove this option and its notes?</p><button className="button secondary" type="button" onClick={() => setConfirmRemove(false)}>Keep option</button><button className="button danger" type="button" onClick={async () => { if (await removeEntry(editing.id, editing.revision)) setEditing(null); }}>Remove option</button></div> : <button className="text-link danger-text" type="button" onClick={() => setConfirmRemove(true)}><Trash2 size={14} />Remove this option</button>}
      <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form></Modal>}
  </div>;
}
