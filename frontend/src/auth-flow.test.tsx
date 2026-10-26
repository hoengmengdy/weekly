import { describe,it,expect,vi,afterEach } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import App from './App';
import { queryClient } from './api';

afterEach(()=>{cleanup();queryClient.clear();vi.restoreAllMocks();localStorage.clear();});
describe('session and report workflow',()=>{
 it('signs in, creates and submits a draft, then signs out',async()=>{
  localStorage.setItem('workday-language-v1','en');window.history.replaceState({},'', '/login');
  const user={id:3,employee_id:'E3',full_name:'Test Employee',username:'employee',email:'employee@example.com',phone:'',position:'',department_id:1,department:'Operations',manager_id:2,role:'employee',active:true,date_joined:'2026-01-01',profile_image_id:null};
  const task={id:1,title:'Review documents',description:'',category_id:null,department_id:1,creator_id:2,priority:'Medium',status:'In Progress',completion_criteria:'',estimated_hours:8,archived:false,start_date:'2026-01-01',deadline:'2027-01-01',created_at:'2026-01-01T00:00:00Z',progress:0,overdue:false,assignments:[{user_id:3,full_name:'Test Employee',progress:0}]};
  const metrics={active_employees:1,total_tasks:1,completed:0,in_progress:1,overdue:0,today_assigned:0,today_submitted:0,awaiting_review:0,approved:0,revisions:0,completion_rate:0,hours:0,employees:[],trend:[],departments:[],upcoming:[],recent_feedback:[]};
  let signedIn=false;let report:Record<string,unknown>|null=null;let createPayload:Record<string,unknown>|null=null;
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
   const path=String(input).split('?')[0];let data:unknown={};let status=200;
   if(path.endsWith('/auth/csrf'))data={csrf_token:'test-csrf'};
   else if(path.endsWith('/auth/me')){data=signedIn?user:{error:{message:'Please sign in'}};status=signedIn?200:401;}
   else if(path.endsWith('/auth/login')){signedIn=true;data={user,csrf_token:'new-csrf'};}
   else if(path.endsWith('/auth/logout')){signedIn=false;data={message:'Signed out'};}
   else if(path.endsWith('/settings'))data={company_name:'Workday'};
   else if(path.includes('/dashboard/'))data=metrics;
   else if(path.endsWith('/tasks'))data={items:[task],total:1,page:1,pages:1,per_page:100};
   else if(path.endsWith('/reports')&&init?.method==='POST'){
    createPayload=JSON.parse(String(init.body));
    report={...createPayload,id:9,user_id:3,status:'Draft',progress:50,total_hours:8,employee_name:user.full_name,task_title:task.title,department:'Operations',attachments:[],reviews:[],manager_feedback:''};data=report;status=201;
   }
   else if(path.endsWith('/reports/9/submit')){report={...report,status:'Submitted'};data=report;}
   else if(path.endsWith('/reports/9'))data=report;
   else data={items:[],total:0,page:1,pages:0,per_page:20};
   return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  });
  render(<App/>);
  await screen.findByRole('button',{name:'Sign in'});
  fireEvent.change(screen.getByLabelText(/Username/),{target:{value:'employee'}});
  fireEvent.change(screen.getByLabelText(/Password/),{target:{value:'Some-test-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Sign in'}));
  await screen.findByRole('heading',{name:'Welcome back, Test'});
  fireEvent.click(screen.getByRole('link',{name:'New report'}));
  await screen.findByRole('button',{name:'Save draft'});
  fireEvent.change(screen.getByLabelText(/Related task/),{target:{value:'1'}});
  const links=Array.from({length:15},(_,i)=>`https://www.facebook.com/example/posts/${i+1}`);
  const pastedLinks=links.map((link,i)=>i===0?'-'+link:i===1?link.replace('https://',''):link);
  fireEvent.change(screen.getByLabelText('Facebook / work links (up to 15)'),{target:{value:pastedLinks.join('\n')}});
  fireEvent.change(screen.getByLabelText('Quantity target'),{target:{value:'10'}});
  fireEvent.change(screen.getByLabelText('Quantity completed'),{target:{value:'5'}});
  fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
  await screen.findByRole('heading',{name:'Review documents'});
  expect(createPayload).toEqual(expect.objectContaining({task_id:1,quantity_target:10,quantity_completed:5,evidence_url:links.join('\n')}));
  expect(screen.getAllByRole('link',{name:/facebook.com/})).toHaveLength(15);
  expect(screen.getAllByRole('link',{name:/facebook.com/})[14]).toHaveAttribute('href',links[14]);
  fireEvent.click(screen.getByRole('button',{name:'Submit report'}));
  await screen.findByText('Submitted');
  expect(screen.queryByRole('button',{name:'Submit report'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Sign out'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Sign in'})).toBeInTheDocument());
  expect(screen.queryByText('Checked source documents')).not.toBeInTheDocument();
 });
});
