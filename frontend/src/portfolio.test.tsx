import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './i18n';
import { ToastProvider } from './ui';
import { Portfolio } from './portfolio';
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
const item={id:1,title:'Product video',kind:'Video',work_date:'2026-10-22',status:'Pending',department_id:1,department:'Marketing',user_id:3,employee_name:'Dara',task_id:null,task_title:null,link:'https://www.facebook.com/ads/1',description:'',attachment:null,created_at:'2026-10-22T00:00:00Z'};
const page={items:[item],total:1,page:1,pages:1,per_page:8,summary:{total:1,pending:1,previous_total:0,kinds:{Poster:{count:0,departments:0},Video:{count:1,departments:1},Photo:{count:0,departments:0}}}};
function respond(url:string) {
 const body=url.includes('/portfolio')?page:url.includes('/departments')?{items:[{id:1,name:'Marketing'}]}:{items:[],pages:1};
 return Promise.resolve(new Response(JSON.stringify(body),{status:200}));
}
function show() {
 return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LanguageProvider><ToastProvider><Portfolio/></ToastProvider></LanguageProvider></QueryClientProvider>);
}
describe('work portfolio',()=>{
 it('shows monthly totals and cards, and filters by type',async()=>{
  localStorage.setItem('workday-language-v1','en');
  const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(input=>respond(String(input)));
  show();
  expect(await screen.findByText('Product video')).toBeInTheDocument();
  expect(screen.getByText('Dara · Marketing')).toBeInTheDocument();
  expect(screen.getByText('facebook.com')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab',{name:'Video · 1'}));
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('kind=Video'),expect.anything()));
 });
 it('requires a file or link before saving new work',async()=>{
  localStorage.setItem('workday-language-v1','en');
  const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(input=>respond(String(input)));
  show();
  fireEvent.click(await screen.findByRole('button',{name:'Add work'}));
  const dialog=within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByPlaceholderText('e.g. Product introduction video'),{target:{value:'Launch poster'}});
  fireEvent.change(dialog.getByRole('combobox',{name:/Department/}),{target:{value:'1'}});
  fireEvent.click(dialog.getByRole('button',{name:'Save work'}));
  expect(await dialog.findByText('Add a file or a link.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/portfolio'),expect.objectContaining({method:'POST'}));
 });
});
