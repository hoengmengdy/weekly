import { useState } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from './i18n';
import { useApi, useAll } from './api';
import { SelectFilter } from './ui';
import { taskStatuses, reportStatuses, type Named, type User } from './types';
import { useAuth } from './auth';
export function useFilters(initial:Record<string,string>={}) {const [values,setValues]=useState<Record<string,string>>({...initial,page:'1'});return {values,set:(key:string,value:string)=>setValues(old=>({...old,[key]:value,...(key!=='page'?{page:'1'}:{})}))};}
export function Filters({values,set,kind='tasks',extended=false}:{values:Record<string,string>;set:(key:string,value:string)=>void;kind?:string;extended?:boolean}) {
 const {t}=useLanguage();const {user}=useAuth();const departments=useApi<{items:Named[]}>('/departments');const categories=useApi<{items:Named[]}>('/categories');const users=useAll<User>('/employees',extended);
 const opts=(data:Named[]|undefined)=>(data||[]).map(x=>({value:String(x.id),label:x.name}));
 return <div className={`filters ${extended?'expanded':''}`}><label className="search"><Search size={17}/><span className="sr-only">{t('Search')}</span><input placeholder={t('Search')} value={values.q||''} onChange={e=>set('q',e.target.value)}/></label>
  <SelectFilter label={kind==='tasks'?'All statuses':'All report statuses'} value={values[kind==='tasks'?'status':'report_status']||''} onChange={v=>set(kind==='tasks'?'status':'report_status',v)} options={(kind==='tasks'?taskStatuses:reportStatuses).map(s=>({value:s,label:s}))}/>
  <SelectFilter label="All priorities" value={values.priority||''} onChange={v=>set('priority',v)} options={['Low','Medium','High','Urgent'].map(s=>({value:s,label:s}))}/>
  {user?.role!=='employee'&&<SelectFilter label="All departments" value={values.department||''} onChange={v=>set('department',v)} options={opts(departments.data?.items)}/>}
  {extended&&<><SelectFilter label="All employees" value={values.employee||''} onChange={v=>set('employee',v)} options={(users.data||[]).map(u=>({value:String(u.id),label:u.full_name}))}/><SelectFilter label="All managers" value={values.manager||''} onChange={v=>set('manager',v)} options={(users.data||[]).filter(u=>u.role!=='employee').map(u=>({value:String(u.id),label:u.full_name}))}/><SelectFilter label="All categories" value={values.category||''} onChange={v=>set('category',v)} options={opts(categories.data?.items)}/>{kind!=='tasks'&&<SelectFilter label="All task statuses" value={values.task_status||''} onChange={v=>set('task_status',v)} options={taskStatuses.map(s=>({value:s,label:s}))}/>}<label className="date-filter">{t('From date')}<input type="date" value={values.date_from||''} onChange={e=>set('date_from',e.target.value)}/></label><label className="date-filter">{t('To date')}<input type="date" value={values.date_to||''} min={values.date_from} onChange={e=>set('date_to',e.target.value)}/></label></>}
 </div>;
}
