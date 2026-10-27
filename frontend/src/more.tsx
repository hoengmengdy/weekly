import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Download, ArrowUpRight, Send } from 'lucide-react';
import { api, useApi, downloadExport, queryString } from './api';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { Filters, useFilters } from './filters';
import { PageHead, Card, Badge, Empty, ErrorBox, Loading, Pager, DataForm, LocalDate, Progress, useToast } from './ui';
import { taskStatuses, type Metrics, type Notice, type Page, type User } from './types';
export function Analytics() {
 const {t}=useLanguage();const {values,set}=useFilters();const q=useApi<Metrics>(`/analytics/performance?${queryString(values)}`);const [error,setError]=useState<unknown>();const [busy,setBusy]=useState(false);const data=q.data;
 return <><PageHead eyebrow="Workspace" title="Analytics & reports"><div className="export-actions">{['csv','xlsx','pdf'].map((f,i)=><button className="btn" key={f} disabled={busy} onClick={async()=>{setError(undefined);setBusy(true);try{await downloadExport(f,queryString(values));}catch(e){setError(e);}finally{setBusy(false);}}}><Download size={15}/>{t(['Export CSV','Export Excel','Export PDF'][i])}</button>)}<button className="btn" onClick={()=>window.print()}>{t('Print')}</button></div></PageHead><Filters values={values} set={set} kind="reports" extended/>{error!==undefined&&<ErrorBox error={error}/>}<p className="context-note">{t('Eligible tasks exclude cancelled tasks. Review quality and context alongside completion rate.')}</p>{q.error?<ErrorBox error={q.error}/>:!data?<Loading/>:<><div className="stats-grid">{[['Assigned tasks',data.total_tasks],['Completed tasks',data.completed],['Completion rate',`${data.completion_rate}%`],['Hours reported',data.hours]].map(([label,value])=><div className="stat-card" key={label}><div className="stat-top">{t(String(label))}</div><strong>{value}</strong></div>)}</div><Card title="Employee"><div className="table-wrap"><table><thead><tr>{['Employee','Assigned','Completed','Incomplete','Overdue tasks','Completion rate','Submitted reports','Approved reports','Revisions','Hours','Output target / actual'].map(h=><th key={h}>{t(h)}</th>)}</tr></thead><tbody>{data.employees.map(e=><tr key={e.id}><td><strong>{e.name}</strong><small className="table-sub">{t(e.department)}</small></td><td>{e.assigned}</td><td>{e.completed}</td><td>{e.incomplete}</td><td>{e.overdue}</td><td><Progress value={e.completion_rate}/></td><td>{e.reports_submitted}</td><td>{e.approved}</td><td>{e.revisions}</td><td>{e.hours}</td><td>{e.target} / {e.actual}</td></tr>)}</tbody></table></div>{!data.employees.length&&<Empty/>}</Card></>}</>;
}
export function Notifications() {
 const {t,lang}=useLanguage();const {values,set}=useFilters();const q=useApi<Page<Notice>>(`/notifications?${queryString(values)}`);
 return <><PageHead title="Notifications"/><Card><div className="list-options"><label><input type="checkbox" checked={values.unread==='true'} onChange={e=>set('unread',e.target.checked?'true':'')}/> {t('Unread only')}</label></div>{q.error?<ErrorBox error={q.error}/>:!q.data?<Loading/>:q.data.items.length?<><div className="notification-list">{q.data.items.map(n=><div className={`notification ${n.read?'':'unread'}`} key={n.id}><span className="stat-icon blue"><Bell size={18}/></span><div><Link to={n.link}>{noticeText(n.message,lang,t)}</Link><small><LocalDate value={n.created_at} withTime/></small></div>{!n.read&&<MarkRead id={n.id} onDone={()=>void q.refetch()}/>}<Link to={n.link} aria-label={t('View all')}><ArrowUpRight size={18}/></Link></div>)}</div><Pager data={q.data} onChange={v=>set('page',String(v))}/></>:<Empty/>}</Card></>;
}
function MarkRead({id,onDone}:{id:number;onDone:()=>void}) {const {t}=useLanguage();const toast=useToast();return <button className="btn" onClick={async()=>{try{await api(`/notifications/${id}/read`,'PATCH',{});onDone();}catch(e){toast(e instanceof Error?e.message:String(e));}}}>{t('Mark as read')}</button>;}
export function Settings() {
 const {user}=useAuth();const {t}=useLanguage();const toast=useToast();const settings=useApi<{company_name:string;allow_overnight:boolean;max_upload_bytes:number}>('/settings');const [error,setError]=useState<unknown>();
 if(!user)return null;
 return <><PageHead title="Profile & settings"/><div className="settings-grid"><Card title="Employee"><div className="profile-summary"><span className="avatar large">{user.profile_image_id?<img src={`/api/v1/auth/profile-image?v=${user.profile_image_id}`} alt={user.full_name}/>:user.full_name[0]}</span><div><strong>{user.full_name}</strong><small>{user.email}</small></div></div>{error!==undefined&&<ErrorBox error={error}/>}<div className="profile-upload"><label>{t('Profile image')}<input type="file" accept=".png,.jpg,.jpeg" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const form=new FormData();form.append('file',file);try{await api<User>('/auth/profile-image','POST',form);toast(t('Saved successfully'));}catch(err){setError(err);}}}/></label></div><DataForm fields={[{name:'full_name',label:'Full name',required:true},{name:'phone',label:'Phone',type:'tel'},{name:'position',label:'Position'}]} initial={{full_name:user.full_name,phone:user.phone,position:user.position}} onSave={async values=>{await api('/auth/profile','PATCH',values);toast(t('Saved successfully'));}}/></Card><Card title="Change password"><DataForm fields={[{name:'current_password',label:'Current password',type:'password',required:true,wide:true},{name:'new_password',label:'New password',type:'password',required:true,wide:true,hint:'12 or more characters'}]} submit="Change password" onSave={async values=>{await api('/auth/change-password','POST',values);toast(t('Saved successfully'));}}/></Card><TelegramCard connected={!!user.telegram_connected}/></div>{user.role==='super_admin'&&<Card title="System settings">{settings.error?<ErrorBox error={settings.error}/>:settings.data?<DataForm fields={[{name:'company_name',label:'Company name',required:true}]} initial={{company_name:settings.data.company_name}} onSave={async values=>{await api('/settings','PATCH',values);await settings.refetch();toast(t('Saved successfully'));}}/>:<Loading/>}<Link className="text-link padded-link" to="/audit">{t('Audit log')} <ArrowUpRight size={16}/></Link></Card>}</>;
}
export function Audit() {
 const {t}=useLanguage();const {values,set}=useFilters();const q=useApi<Page<{id:number;actor_id:number;entity:string;entity_id:number;action:string;details:Record<string,unknown>;created_at:string}>>(`/audit-logs?${queryString(values)}`);
 return <><PageHead title="Audit log"/><Card>{q.error?<ErrorBox error={q.error}/>:!q.data?<Loading/>:<><div className="table-wrap"><table><thead><tr><th>ID</th><th>{t('Employee')}</th><th>{t('History')}</th><th>{t('Date')}</th></tr></thead><tbody>{q.data.items.map(a=><tr key={a.id}><td>{a.id}</td><td>#{a.actor_id}</td><td><strong>{a.action.replaceAll('_',' ')}</strong><small className="table-sub">{a.entity} #{a.entity_id}</small><details><summary>{t('View all')}</summary><pre>{JSON.stringify(a.details,null,2)}</pre></details></td><td><LocalDate value={a.created_at} withTime/></td></tr>)}</tbody></table></div><Pager data={q.data} onChange={v=>set('page',String(v))}/></>}</Card></>;
}
export function Missing({denied=false}:{denied?:boolean}) {const {t}=useLanguage();return <div className="missing"><span>{denied?'403':'404'}</span><h1>{t(denied?'Access denied':'Page not found')}</h1>{denied&&<p className="muted">{t('Your role does not allow access to this page.')}</p>}<Link className="btn primary" to="/">{t('Go to dashboard')}</Link></div>;}


function TelegramCard({connected}:{connected:boolean}) {
 const {t}=useLanguage();const toast=useToast();const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>();
 const connect=async()=>{
  // Open the tab inside the click so pop-up blockers allow it, then point it at the bot.
  const tab=window.open('','_blank');setBusy(true);setError(undefined);
  try{const {url}=await api<{url:string}>('/auth/telegram/link','POST',{});if(tab)tab.location.href=url;else window.location.href=url;}
  catch(e){tab?.close();setError(e);}finally{setBusy(false);}
 };
 const disconnect=async()=>{setBusy(true);try{await api('/auth/telegram','DELETE');toast(t('Telegram disconnected'));}catch(e){setError(e);}finally{setBusy(false);}};
 return <Card title="Telegram"><div className="telegram-card"><p className="muted">{t(connected?'Telegram is connected. You get a message when a new task is assigned to you.':'Connect Telegram to get a message when a new task is assigned to you.')}</p>{!connected&&<p className="muted">{t('After you press Start in Telegram, come back to this page.')}</p>}{error!==undefined&&<ErrorBox error={error}/>}{connected?<div className="actions"><Badge value="Connected"/><button className="btn" disabled={busy} onClick={()=>void disconnect()}>{t('Disconnect')}</button></div>:<button className="btn primary" disabled={busy} onClick={()=>void connect()}><Send size={16}/>{t(busy?'Loading':'Connect Telegram')}</button>}</div></Card>;
}

// Notifications are stored in English by the server; show the Khmer wording when the page is in Khmer.
const NOTICE_KM:[RegExp,string][]=[
 [/^New task assigned: (.+)$/s,'ការងារថ្មី: $1'],[/^You were unassigned from (.+)\.$/s,'អ្នកត្រូវបានដកចេញពីការងារ: $1'],
 [/^(.+) commented on (.+)$/s,'$1 បានបញ្ចេញមតិលើ $2'],[/^(.+) submitted a report for (.+)$/s,'$1 បានបញ្ជូនរបាយការណ៍សម្រាប់ $2'],
 [/^Report approved: (.+)$/s,'របាយការណ៍ត្រូវបានអនុម័ត: $1'],[/^Revision requested: (.+)$/s,'សំណើឱ្យកែប្រែរបាយការណ៍: $1'],
 [/^Report reopened: (.+)$/s,'របាយការណ៍ត្រូវបានបើកឡើងវិញ: $1'],[/^(.+) is overdue\.$/s,'$1 ហួសកាលកំណត់'],[/^(.+) is due soon\.$/s,'$1 ជិតដល់កាលកំណត់'],
];
function noticeText(message:string,lang:string,t:(word:string)=>string) {
 if(lang!=='km')return message;
 for(const [pattern,khmer] of NOTICE_KM)if(pattern.test(message))return message.replace(pattern,khmer);
 const status=taskStatuses.find(s=>message.endsWith(`: ${s}`));
 return status?`${message.slice(0,-status.length)}${t(status)}`:message;
}
