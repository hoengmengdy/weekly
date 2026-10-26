import { createContext, useContext, type ReactNode } from 'react';
import { Navigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layers, ArrowUpRight, Globe2 } from 'lucide-react';
import { useApi, api, ApiError } from './api';
import { useLanguage } from './i18n';
import { DataForm, ErrorBox, Loading, useToast } from './ui';
import type { User, Role } from './types';
const AuthContext=createContext<{user:User|null;loading:boolean;error:unknown}>({user:null,loading:true,error:null});
export const useAuth=()=>useContext(AuthContext);
export function AuthProvider({children}:{children:ReactNode}) {const q=useApi<User>('/auth/me');return <AuthContext.Provider value={{user:q.data||null,loading:q.isLoading,error:q.error instanceof ApiError&&q.error.status===401?null:q.error}}>{children}</AuthContext.Provider>;}
export function Guard({roles,children}:{roles?:Role[];children:ReactNode}) {const {user,loading,error}=useAuth();if(loading)return <Loading/>;if(error)return <ErrorBox error={error} retry={()=>window.location.reload()}/>;if(!user)return <Navigate to="/login" replace/>;if(roles&&!roles.includes(user.role))return <Navigate to="/access-denied" replace/>;return <>{children}</>;}
export function LanguageToggle() {const {lang,setLang}=useLanguage();return <button className="language-btn" onClick={()=>setLang(lang==='km'?'en':'km')} aria-label="Switch language"><Globe2 size={16}/>{lang==='km'?'English':'ខ្មែរ'}</button>;}
export function LoginPage() {
 const location=useLocation();const [params]=useSearchParams();const mode=location.pathname;const {user}=useAuth();const client=useQueryClient();const {t}=useLanguage();const toast=useToast();
 if(user&&mode==='/login')return <Navigate to="/" replace/>;
 const forgot=mode==='/forgot-password',reset=mode==='/reset-password';
 return <div className="auth-page"><aside className="auth-story"><div className="brand"><span className="brand-icon"><Layers size={24}/></span>workday<span className="brand-dot">.</span></div><div><div className="eyebrow">WORK BETTER, TOGETHER</div><h1>{t('Track work, share progress, and keep everyone aligned.')}</h1><div className="story-lines"><div/><div/><div/></div></div><p>EMPLOYEE WORKSPACE <ArrowUpRight size={18}/></p></aside><main className="auth-main"><div className="auth-language"><LanguageToggle/></div><div className="auth-form"><span className="eyebrow">{t('Workspace')}</span><h1>{t(forgot?'Forgot password?':reset?'Reset password':'Welcome to your workspace')}</h1><p className="muted">{t('Sign in to manage tasks and daily progress.')}</p><DataForm key={mode} fields={forgot?[{name:'email',label:'Email',type:'email',required:true,wide:true}]:reset?[{name:'password',label:'New password',type:'password',required:true,hint:'12 or more characters',wide:true}]:[{name:'username',label:'Username',required:true,wide:true},{name:'password',label:'Password',type:'password',required:true,wide:true}]} submit={forgot?'Send reset link':reset?'Reset password':'Sign in'} onSave={async values=>{if(forgot){const result=await api<{message:string}>('/auth/forgot-password','POST',values);toast(result.message);}else if(reset){const result=await api<{message:string}>('/auth/reset-password','POST',{...values,token:params.get('token')});toast(result.message);}else {const result=await api<{user:User}>('/auth/login','POST',values);client.removeQueries({predicate:q=>q.queryKey[0]!=='/auth/me'});client.setQueryData(['/auth/me'],result.user);}}}/><Link className="text-link" to={forgot||reset?'/login':'/forgot-password'}>{t(forgot||reset?'Return to sign in':'Forgot password?')}</Link><p className="auth-foot">{t('Role permissions are enforced by the server.')}</p></div></main></div>;
}

