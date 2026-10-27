import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Inbox, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from './i18n';
import type { Page } from './types';

const ToastContext=createContext((_message:string)=>{});
export const useToast=()=>useContext(ToastContext);
export function ToastProvider({children}:{children:ReactNode}) {
 const [message,setMessage]=useState('');
 useEffect(()=>{if(message){const timeout=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(timeout);}},[message]);
 return <ToastContext.Provider value={setMessage}>{children}{message&&<div className="toast" role="status"><Check size={18}/>{message}<button aria-label="Close" onClick={()=>setMessage('')}><X size={16}/></button></div>}</ToastContext.Provider>;
}
export function PageHead({eyebrow,title,description,children}:{eyebrow?:string;title:string;description?:string;children?:ReactNode}) {const {t}=useLanguage();return <div className="page-head"><div>{eyebrow&&<p className="eyebrow">{t(eyebrow)}</p>}<h1>{t(title)}</h1>{description&&<p className="muted">{t(description)}</p>}</div><div className="actions">{children}</div></div>;}
export function ErrorBox({error,retry}:{error:unknown;retry?:()=>void}) {const {t}=useLanguage();return <div className="error" role="alert"><AlertCircle size={20}/><span>{error instanceof Error?error.message:String(error)}</span>{retry&&<button className="btn" onClick={retry}>{t('Try again')}</button>}</div>;}
export function Empty({message='No records yet'}:{message?:string}) {const {t}=useLanguage();return <div className="empty"><span className="empty-icon"><Inbox size={29}/></span><h3>{t(message)}</h3><p>{t('Your work will appear here as it is added.')}</p></div>;}
export function Loading() {const {t}=useLanguage();return <div className="skeletons" role="status" aria-label={t('Loading')}>{[1,2,3].map(i=><div key={i} className="skeleton"/>)}</div>;}
export function Badge({value}:{value:string}) {const {t}=useLanguage();return <span className={`badge ${value.toLowerCase().replaceAll(' ','-')}`}><span className="badge-dot"/>{t(value)}</span>;}
export function Progress({value}:{value:number}) {return <div className="progress-wrap"><div className="progress-track"><span style={{width:`${value}%`}}/></div><small>{Math.round(value)}%</small></div>;}
export function Pager({data,onChange}:{data:Page<unknown>;onChange:(page:number)=>void}) {const {t}=useLanguage();return <div className="pager"><span>{data.total} · {data.page} / {Math.max(data.pages,1)}</span><div className="actions"><button className="btn" disabled={data.page<=1} onClick={()=>onChange(data.page-1)}><ChevronLeft size={15}/>{t('Previous')}</button><button className="btn" disabled={data.page>=data.pages} onClick={()=>onChange(data.page+1)}>{t('Next')}<ChevronRight size={15}/></button></div></div>;}
export function Card({title,children,action}:{title?:string;children:ReactNode;action?:ReactNode}) {const {t}=useLanguage();return <section className="card">{title&&<div className="card-head"><h2>{t(title)}</h2>{action}</div>}{children}</section>;}
export function Back({to}:{to:string}) {const {t}=useLanguage();return <Link className="back" to={to}><ChevronLeft size={16}/>{t('Back')}</Link>;}
const KM_MONTHS=['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
const kmDigits=(text:string)=>text.replace(/\d/g,d=>'០១២៣៤៥៦៧៨៩'[Number(d)]);
// Browsers often ship without Khmer date data and silently fall back to English, so Khmer dates are built by hand.
export function formatDate(value:string|Date,lang:string,{withTime=false,monthOnly=false}={}) {
 const date=typeof value==='string'?new Date(value.length===10?value+'T00:00:00+07:00':value):value;
 if(lang!=='km')return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Phnom_Penh',...(monthOnly?{month:'long' as const,year:'numeric' as const}:{dateStyle:'medium' as const,...(withTime?{timeStyle:'short' as const}:{})})}).format(date);
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
 const month=`${KM_MONTHS[Number(p.month)-1]} ${p.year}`;
 return kmDigits(monthOnly?month:`${Number(p.day)} ${month}${withTime?`, ${p.hour}:${p.minute}`:''}`);
}
export function LocalDate({value,withTime=false}:{value:string;withTime?:boolean}) {const {lang}=useLanguage();return <>{formatDate(value,lang,{withTime})}</>;}
export interface FieldSpec {name:string;label:string;type?:string;required?:boolean;options?:{value:string;label:string}[];wide?:boolean;hint?:string;readOnly?:boolean;min?:number;max?:number;step?:string;placeholder?:string;newRow?:boolean}
export function DataForm({fields,initial={},schema,submit='Save',onSave,children}:{fields:FieldSpec[];initial?:Record<string,unknown>;schema?:z.ZodType<Record<string,unknown>>;submit?:string;onSave:(data:Record<string,unknown>)=>Promise<void>;children?:ReactNode}) {
 const {t}=useLanguage();const [error,setError]=useState<unknown>();
 const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<Record<string,unknown>>({defaultValues:initial,resolver:schema?zodResolver(schema):undefined});
 return <form className="data-form" onSubmit={handleSubmit(async values=>{setError(undefined);try{await onSave(values);}catch(e){setError(e);}})}>
  {error!==undefined&&<div className="full"><ErrorBox error={error}/></div>}
  {fields.map(f=><div className={`field ${f.wide?'full':''} ${f.newRow?'new-row':''}`} key={f.name}><label htmlFor={f.name}>{t(f.label)}{f.required&&<span className="required"> *</span>}</label>
   {f.type==='textarea'?<textarea id={f.name} rows={4} required={f.required} {...register(f.name)} readOnly={f.readOnly}/>:
    f.type==='select'||f.type==='multiselect'?<select id={f.name} multiple={f.type==='multiselect'} required={f.required} {...register(f.name)} disabled={f.readOnly}>{f.type!=='multiselect'&&<option value="">{t('Select')}</option>}{f.options?.map(o=><option key={o.value} value={o.value}>{t(o.label)}</option>)}</select>:
    f.type==='checkbox'?<input id={f.name} type="checkbox" {...register(f.name)}/>:
    <input id={f.name} type={f.type||'text'} required={f.required} min={f.min} max={f.max} step={f.step||'any'} placeholder={f.placeholder?t(f.placeholder):undefined} readOnly={f.readOnly} {...register(f.name)}/>}
   {f.hint&&<small className="muted">{t(f.hint)}</small>}{errors[f.name]&&<small role="alert" className="field-error">{String(errors[f.name]?.message)}</small>}
  </div>)}{children}<div className="full form-footer"><button className="btn primary" disabled={isSubmitting}>{t(isSubmitting?'Loading':submit)}</button></div>
 </form>;
}
export function Confirm({title,message,onConfirm,children}:{title:string;message:string;onConfirm:()=>Promise<void>;children:ReactNode}) {
 const dialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);const {t}=useLanguage();const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>();
 return <><button ref={trigger} className="btn" onClick={()=>dialog.current?.showModal()}>{children}</button><dialog ref={dialog} className="modal" onClose={()=>trigger.current?.focus()}><div className="card-head"><h2>{t(title)}</h2><button aria-label={t('Close')} onClick={()=>dialog.current?.close()}><X size={20}/></button></div><p>{t(message)}</p>{error!==undefined&&<ErrorBox error={error}/>}<div className="actions"><button className="btn" onClick={()=>dialog.current?.close()}>{t('Cancel')}</button><button className="btn primary" disabled={busy} onClick={async()=>{setBusy(true);try{await onConfirm();dialog.current?.close();}catch(e){setError(e);}finally{setBusy(false);}}}>{t('Confirm')}</button></div></dialog></>;
}
export function SelectFilter({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:{value:string;label:string}[]}) {const {t}=useLanguage();return <label className="filter-label"><span className="sr-only">{t(label)}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">{t(label)}</option>{options.map(o=><option value={o.value} key={o.value}>{t(o.label)}</option>)}</select></label>;}
