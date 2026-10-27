import { useRef, useState, type ReactNode } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Link2, MoreHorizontal, Play, Plus, Upload, X } from 'lucide-react';
import { api, useAll, useApi, queryString } from './api';
import { useLanguage } from './i18n';
import { Badge, Empty, ErrorBox, LocalDate, Loading, PageHead, useToast } from './ui';
import { shrinkImage } from './photos';
import type { Attachment, Named, Page, Task, User } from './types';

const KINDS = ['Poster', 'Video', 'Photo'] as const;
type Kind = typeof KINDS[number];
const PAGE_SIZE = 8;
// Hosts cap request bodies (Vercel: 4.5 MB). Images are shrunk first; larger PDFs and videos go in as links.
const MAX_UPLOAD = 4 * 1024 * 1024;

export interface PortfolioItem {id:number; title:string; kind:Kind; work_date:string; status:'Pending'|'Approved'; department_id:number|null; department:string|null; user_id:number|null; employee_name:string|null; task_id:number|null; task_title:string|null; link:string; description:string; attachment:Attachment|null; created_at:string}
interface PortfolioPage extends Page<PortfolioItem> {summary:{total:number; pending:number; previous_total:number; kinds:Record<Kind,{count:number; departments:number}>}}

const monthKey = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const shiftMonth = (d:Date, by:number) => new Date(d.getFullYear(), d.getMonth()+by, 1);
const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Phnom_Penh'});

async function downloadPortfolio(month:string) {
 const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/exports/portfolio.pdf?month=${month}`, {credentials:'include'});
 if(!res.ok) {const data = await res.json().catch(()=>({}));throw new Error(data.error?.message || 'Export failed');}
 const url = URL.createObjectURL(await res.blob());const a = document.createElement('a');a.href = url;a.download = `work-portfolio-${month}.pdf`;a.click();URL.revokeObjectURL(url);
}

export function Portfolio() {
 const {t, lang} = useLanguage();const toast = useToast();
 const [month, setMonth] = useState(() => {const [y, m] = today().split('-').map(Number);return new Date(y, m-1, 1);});
 const [filters, setFilters] = useState({kind:'', department:'', employee:'', status:'', q:''});
 const [size, setSize] = useState(PAGE_SIZE);const [adding, setAdding] = useState(false);
 const set = (key:keyof typeof filters, value:string) => {setFilters(old => ({...old, [key]:value}));setSize(PAGE_SIZE);};
 const path = `/portfolio?${queryString({...filters, month:monthKey(month), per_page:String(size)})}`;
 // Keep showing the current cards while a filter or "load more" fetches the next page.
 const q = useQuery({queryKey:[path], queryFn:() => api<PortfolioPage>(path), placeholderData:keepPreviousData});
 const departments = useApi<{items:Named[]}>('/departments');const users = useAll<User>('/employees');
 const monthLabel = new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : 'en-GB', {month:'long', year:'numeric'}).format(month);
 const s = q.data?.summary;const growth = s ? s.total - s.previous_total : 0;
 const fromDepartments = (n:number) => `${t('From')} ${n} ${t('departments')}`;
 return <>
  <PageHead eyebrow="Analytics & reports" title="Work portfolio" description="Store posters, videos and work photos to prepare the monthly report.">
   <button className="btn" onClick={async () => {try {await downloadPortfolio(monthKey(month));} catch(e) {toast(e instanceof Error ? e.message : String(e));}}}><Download size={16}/>{t('Export monthly report (PDF)')}</button>
   <button className="btn primary" onClick={() => setAdding(true)}><Plus size={17}/>{t('Add work')}</button>
  </PageHead>
  <section className="card portfolio-summary">
   <div className="month-nav"><button className="btn" aria-label={t('Previous month')} onClick={() => {setMonth(shiftMonth(month, -1));setSize(PAGE_SIZE);}}><ChevronLeft size={16}/></button><h2>{monthLabel}</h2><button className="btn" aria-label={t('Next month')} onClick={() => {setMonth(shiftMonth(month, 1));setSize(PAGE_SIZE);}}><ChevronRight size={16}/></button></div>
   <div className="portfolio-stats">
    <div className="portfolio-stat total"><small>{t('Total works')}</small><strong>{s?.total ?? '—'}</strong><span>{growth >= 0 ? '+' : ''}{growth} {t('compared to last month')}</span></div>
    {KINDS.map(kind => <div key={kind} className={`portfolio-stat ${kind.toLowerCase()}`}><small>{t(kind)}</small><strong>{s?.kinds[kind].count ?? '—'}</strong><span>{fromDepartments(s?.kinds[kind].departments ?? 0)}</span></div>)}
    <div className="portfolio-stat pending"><small>{t('Pending approval')}</small><strong>{s?.pending ?? '—'}</strong><button className="text-link" onClick={() => set('status', filters.status === 'Pending' ? '' : 'Pending')}>{t(filters.status === 'Pending' ? 'Show all' : 'View pending')}</button></div>
   </div>
  </section>
  <div className="portfolio-toolbar">
   <div className="portfolio-tabs" role="tablist">{(['', ...KINDS] as const).map(kind => <button key={kind} role="tab" aria-selected={filters.kind === kind} className={filters.kind === kind ? 'active' : ''} onClick={() => set('kind', kind)}>{t(kind || 'All')} · {kind ? s?.kinds[kind].count ?? 0 : s?.total ?? 0}</button>)}</div>
   <div className="portfolio-filters">
    <label><small>{t('Department')}</small><select value={filters.department} onChange={e => set('department', e.target.value)}><option value="">{t('All')}</option>{departments.data?.items.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label><small>{t('Employee')}</small><select value={filters.employee} onChange={e => set('employee', e.target.value)}><option value="">{t('All')}</option>{users.data?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
    <label><small>{t('Search')}</small><input value={filters.q} placeholder={t('Title or description…')} onChange={e => set('q', e.target.value)}/></label>
   </div>
  </div>
  {q.error ? <ErrorBox error={q.error} retry={() => void q.refetch()}/> : !q.data ? <Loading/> : !q.data.items.length ? <section className="card"><Empty message="No works this month"/></section> : <>
   <div className="portfolio-grid">{q.data.items.map(item => <WorkCard key={item.id} item={item}/>)}</div>
   <div className="portfolio-more"><span>{t('Showing')} {q.data.items.length} {t('of')} {q.data.total}</span>{q.data.items.length < q.data.total && <button className="btn" disabled={q.isFetching} onClick={() => setSize(size + PAGE_SIZE)}>{t(q.isFetching ? 'Loading' : 'Load more')}</button>}</div>
  </>}
  {adding && <AddWork month={monthLabel} departments={departments.data?.items || []} users={users.data || []} onClose={() => setAdding(false)}/>}
 </>;
}

function WorkCard({item}:{item:PortfolioItem}) {
 const {t} = useLanguage();const toast = useToast();const menu = useRef<HTMLDetailsElement>(null);
 const file = item.attachment;const image = file?.mime?.startsWith('image/');
 const open = item.link || (file && (image ? `${file.url}?inline=1` : file.url)) || '';
 const act = async (run:() => Promise<unknown>, done:string) => {menu.current?.removeAttribute('open');try {await run();toast(t(done));} catch(e) {toast(e instanceof Error ? e.message : String(e));}};
 let thumb:ReactNode;
 if(image) thumb = <img src={`${file!.url}?inline=1`} alt={item.title} loading="lazy"/>;
 else if(item.kind === 'Video') thumb = <span className="play"><Play size={22} fill="currentColor"/></span>;
 else thumb = <span className="thumb-icon">{file ? <FileText size={34}/> : <ImageIcon size={34}/>}</span>;
 return <article className="card work-card">
  <a className={`work-thumb ${item.kind.toLowerCase()}`} href={open || undefined} target="_blank" rel="noopener noreferrer" aria-label={item.title}>{thumb}<span className="work-kind">{t(item.kind)}</span></a>
  <details className="work-menu" ref={menu}><summary aria-label={t('More actions')}><MoreHorizontal size={16}/></summary><div>
   {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer">{t('Open link')}</a>}
   {file && <a href={open} target="_blank" rel="noopener noreferrer">{t('Open file')}</a>}
   {item.status === 'Pending' && <button onClick={() => void act(() => api(`/portfolio/${item.id}/approve`, 'POST', {}), 'Approved')}>{t('Approve')}</button>}
   <button className="danger" onClick={() => {if(window.confirm(t('Delete this work?'))) void act(() => api(`/portfolio/${item.id}`, 'DELETE'), 'Deleted');}}>{t('Delete')}</button>
  </div></details>
  <div className="work-body">
   <h3 title={item.title}>{item.title}</h3>
   <p className="work-person"><span className="avatar small">{(item.employee_name || '?')[0]}</span>{[item.employee_name, item.department].filter(Boolean).join(' · ') || '—'}</p>
   {(item.task_title || item.link) && <p className="work-chip"><Link2 size={12}/>{item.task_title || hostname(item.link)}</p>}
   <div className="work-foot"><small><LocalDate value={item.work_date}/></small><Badge value={item.status}/></div>
  </div>
 </article>;
}

function hostname(link:string) {try {return new URL(link).hostname.replace(/^www\./, '');} catch {return link;}}

function AddWork({month, departments, users, onClose}:{month:string; departments:Named[]; users:User[]; onClose:() => void}) {
 const {t} = useLanguage();const toast = useToast();const tasks = useAll<Task>('/tasks');
 const [mode, setMode] = useState<'file'|'link'>('file');const [file, setFile] = useState<File|null>(null);const [dragging, setDragging] = useState(false);
 const [form, setForm] = useState({title:'', kind:'Poster' as Kind, work_date:today(), department_id:'', user_id:'', task_id:'', link:'', description:'', needs_approval:false});
 const [busy, setBusy] = useState(false);const [error, setError] = useState<unknown>();
 const field = (key:keyof typeof form) => ({value:String(form[key]), onChange:(e:{target:{value:string}}) => setForm(old => ({...old, [key]:e.target.value}))});
 const pick = (picked?:File) => {
  if(!picked) return;
  if(!/^(image\/(jpeg|png)|application\/pdf)$/.test(picked.type)) {setError(new Error(t('Upload a JPG, PNG or PDF file. Add videos as a link.')));return;}
  if(picked.type === 'application/pdf' && picked.size > MAX_UPLOAD) {setError(new Error(t('File is too large. Add it as a link instead.')));return;}
  setError(undefined);setFile(picked);if(picked.type.startsWith('image/') && form.kind === 'Video') setForm(old => ({...old, kind:'Photo'}));
 };
 const save = async () => {
  setError(undefined);
  if(!form.title.trim() || !form.work_date || !form.department_id) {setError(new Error(t('Fill in the required fields.')));return;}
  if(mode === 'file' ? !file : !form.link.trim()) {setError(new Error(t('Add a file or a link.')));return;}
  setBusy(true);
  try {
   const item = await api<PortfolioItem>('/portfolio', 'POST', {...form, link:mode === 'link' ? form.link : '', department_id:Number(form.department_id), user_id:form.user_id ? Number(form.user_id) : null, task_id:form.task_id ? Number(form.task_id) : null});
   if(mode === 'file' && file) {
    const body = new FormData();body.append('file', file.type.startsWith('image/') ? await shrinkImage(file) : file);
    try {await api(`/portfolio/${item.id}/file`, 'POST', body);} catch(e) {toast(`${t('The work was saved, but the file could not be uploaded')}: ${e instanceof Error ? e.message : ''}`);onClose();return;}
   }
   toast(t('Saved successfully'));onClose();
  } catch(e) {setError(e);} finally {setBusy(false);}
 };
 return <div className="portfolio-modal" role="dialog" aria-modal="true" aria-labelledby="add-work-title" onKeyDown={e => {if(e.key === 'Escape') onClose();}}>
  <button className="portfolio-scrim" aria-label={t('Close')} onClick={onClose}/>
  <div className="portfolio-dialog">
   <div className="dialog-head"><div><h2 id="add-work-title">{t('Add work')}</h2><p className="muted">{t('This work will be included in the report for')} {month}</p></div><button aria-label={t('Close')} onClick={onClose}><X size={20}/></button></div>
   <div className="dialog-body">
    <div className="segmented">{(['file', 'link'] as const).map(m => <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>{t(m === 'file' ? 'Upload file' : 'Add link (Drive, YouTube, Facebook)')}</button>)}</div>
    {mode === 'file' ? <>
     <label className={`dropzone ${dragging ? 'over' : ''}`} onDragOver={e => {e.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault();setDragging(false);pick(e.dataTransfer.files[0]);}}>
      <span className="dropzone-icon"><Upload size={20}/></span><strong>{t('Drop a file here or')} <u>{t('choose a file')}</u></strong><small>{t('JPG, PNG or PDF · up to 4 MB. Add videos as a link.')}</small>
      <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => {pick(e.target.files?.[0]);e.target.value = '';}}/>
     </label>
     {file && <div className="picked-file"><span className="thumb-icon">{file.type.startsWith('image/') ? <ImageIcon size={18}/> : <FileText size={18}/>}</span><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></div><button aria-label={`${t('Remove')}: ${file.name}`} onClick={() => setFile(null)}><X size={16}/></button></div>}
    </> : <label className="field"><span>{t('Link')} <span className="required">*</span></span><input type="url" placeholder="https://" {...field('link')}/></label>}
    <label className="field"><span>{t('Title')} <span className="required">*</span></span><input placeholder={t('e.g. Product introduction video')} {...field('title')}/></label>
    <div className="field"><span>{t('Type')} <span className="required">*</span></span><div className="kind-picker">{KINDS.map(kind => <button key={kind} className={form.kind === kind ? 'active' : ''} aria-pressed={form.kind === kind} onClick={() => setForm(old => ({...old, kind}))}>{t(kind)}</button>)}</div></div>
    <div className="dialog-row">
     <label className="field"><span>{t('Work date')} <span className="required">*</span></span><input type="date" {...field('work_date')}/></label>
     <label className="field"><span>{t('Department')} <span className="required">*</span></span><select {...field('department_id')}><option value="">{t('Select')}</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    </div>
    <label className="field"><span>{t('Employee')}</span><select {...field('user_id')}><option value="">{t('Select')}</option>{users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
    <label className="field"><span>{t('Link to task')}</span><select {...field('task_id')}><option value="">{t('Choose a task from the Tasks list…')}</option>{tasks.data?.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
    <label className="field"><span>{t('Description')}</span><textarea rows={3} placeholder={t('Purpose, results, or where it was published (Facebook, TikTok…)')} {...field('description')}/></label>
    <label className="check-line"><input type="checkbox" checked={form.needs_approval} onChange={e => setForm(old => ({...old, needs_approval:e.target.checked}))}/>{t('Send to the approval center before adding to the report')}</label>
    {error !== undefined && <ErrorBox error={error}/>}
   </div>
   <div className="dialog-foot"><button className="btn" onClick={onClose}>{t('Cancel')}</button><button className="btn primary" disabled={busy} onClick={() => void save()}>{t(busy ? 'Loading' : 'Save work')}</button></div>
  </div>
 </div>;
}
