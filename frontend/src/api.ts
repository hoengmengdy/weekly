import { QueryClient, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
export const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:15000,refetchOnWindowFocus:true}}});
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
let csrf = '';
export class ApiError extends Error { constructor(message:string, public status:number) { super(message); } }
export async function api<T>(path:string, method='GET', body?:unknown, attempt=0):Promise<T> {
  if(method!=='GET' && !csrf) csrf = (await api<{csrf_token:string}>('/auth/csrf')).csrf_token;
  const form = body instanceof FormData;
  const response = await fetch(base+path, {method,credentials:'include',headers:{...(body&&!form?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRFToken':csrf}:{})},body:body?(form?body:JSON.stringify(body)):undefined});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) {
    if(response.status===400&&method!=='GET'&&attempt===0&&/CSRF/i.test(data.error?.message||'')) {
      csrf=(await api<{csrf_token:string}>('/auth/csrf')).csrf_token;
      return api<T>(path,method,body,1);
    }
    if(response.status===401&&path!=='/auth/login') queryClient.setQueryData(['/auth/me'],null);
    throw new ApiError(data.error?.message || 'Request failed',response.status);
  }
  if(data.csrf_token) csrf=data.csrf_token;
  if(path==='/auth/logout') csrf='';
  if(method!=='GET'&&!path.startsWith('/auth/login')&&!path.startsWith('/auth/logout')) void queryClient.invalidateQueries();
  return data as T;
}
export function useApi<T>(path:string,enabled=true) {return useQuery({queryKey:[path],queryFn:()=>api<T>(path),enabled,retry:(count,error)=>error instanceof ApiError&&[401,403,404].includes(error.status)?false:count<1});}
export function useAll<T>(path:string,enabled=true) {return useQuery({queryKey:['all',path],enabled,queryFn:async()=>{const items:T[]=[];let page=1;let pages=1;do{const result=await api<{items:T[];pages:number}>(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`);items.push(...result.items);pages=result.pages;page++;}while(page<=pages);return items;}});}
export function useAction<T=unknown>(path:string,method='POST') {
  const client = useQueryClient();
  return useMutation({mutationFn:(data?:unknown)=>api<T>(path,method,data),onSuccess:()=>client.invalidateQueries()});
}
export function queryString(values:Record<string,string>) {return new URLSearchParams(Object.entries(values).filter(([,v])=>v!=='')).toString();}
export async function downloadExport(format:string,query:string) {
  const res=await fetch(`${base}/exports/reports.${format}?${query}`,{credentials:'include'});
  if(!res.ok) {const data=await res.json();throw new Error(data.error?.message||'Export failed');}
  const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`work-reports.${format}`;a.click();URL.revokeObjectURL(url);
}
