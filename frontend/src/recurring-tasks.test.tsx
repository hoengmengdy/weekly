import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {TaskForm} from './tasks';
import {LanguageProvider} from './i18n';
import {ToastProvider} from './ui';
import {api} from './api';

vi.mock('./auth',()=>({useAuth:()=>({user:{id:2,role:'manager'}})}));
vi.mock('./api',()=>({
 api:vi.fn(),
 useApi:(path:string)=>({data:path.startsWith('/tasks/')?undefined:{items:[{id:1,name:'Team'}]}}),
 useAll:()=>({data:[{id:3,full_name:'Selected employee',employee_id:'EMP-3'}]}),
}));

beforeEach(()=>{localStorage.setItem('workday-language-v1','en');vi.mocked(api).mockResolvedValue({id:50});});
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear();});
const show=()=>render(<MemoryRouter initialEntries={['/tasks/new']}><LanguageProvider><ToastProvider><Routes>
 <Route path="/tasks/new" element={<TaskForm/>}/><Route path="/tasks/:id" element={<p>Saved task</p>}/>
</Routes></ToastProvider></LanguageProvider></MemoryRouter>);
const fill=()=>{
 fireEvent.change(screen.getByLabelText(/^Title/),{target:{value:'Post VDo'}});
 fireEvent.change(screen.getByLabelText(/^Assignees/),{target:{value:'3'}});
 fireEvent.change(screen.getByLabelText(/^Start date/),{target:{value:'2026-10-28'}});
 fireEvent.change(screen.getByLabelText(/^Deadline/),{target:{value:'2026-10-28'}});
};

describe('daily task scheduling form',()=>{
 it('keeps ordinary tasks non-repeating by default',async()=>{
  show();fill();
  expect(screen.getByLabelText('Repeat daily')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Save task'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/tasks','POST',expect.objectContaining({
   title:'Post VDo',repeat_daily:false,repeat_until:null,assigned_employee_ids:[3],
  })));
 });
 it('saves the chosen assignees, daily repeat and inclusive end date',async()=>{
  show();fill();fireEvent.click(screen.getByLabelText('Repeat daily'));
  fireEvent.change(screen.getByLabelText('Repeat until'),{target:{value:'2026-11-30'}});
  fireEvent.click(screen.getByRole('button',{name:'Save task'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/tasks','POST',expect.objectContaining({
   repeat_daily:true,repeat_until:'2026-11-30',assigned_employee_ids:[3],
  })));
 });
 it('rejects an end date before the first occurrence',async()=>{
  show();fill();fireEvent.click(screen.getByLabelText('Repeat daily'));
  fireEvent.change(screen.getByLabelText('Repeat until'),{target:{value:'2026-10-27'}});
  fireEvent.click(screen.getByRole('button',{name:'Save task'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Repeat until must be on or after start date'));
  expect(api).not.toHaveBeenCalled();
 });
 it('labels the repeat controls in Khmer',()=>{
  localStorage.removeItem('workday-language-v1');show();
  expect(screen.getByLabelText('ធ្វើឡើងវិញរៀងរាល់ថ្ងៃ')).toBeInTheDocument();
  expect(screen.getByLabelText('ធ្វើឡើងវិញរហូតដល់ថ្ងៃ')).toBeInTheDocument();
 });
});
