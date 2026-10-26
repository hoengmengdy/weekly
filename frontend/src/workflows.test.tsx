import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n';
import { DataForm, Badge } from './ui';
import { Guard } from './auth';
import { api } from './api';
import { z } from 'zod';
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
describe('reporting interface',()=>{
 it('renders the work-link label and hint in Khmer without corrupted characters',()=>{render(<LanguageProvider><DataForm fields={[{name:'evidence_url',label:'Facebook / work links (up to 15)',type:'textarea',hint:'Paste up to 15 links, one link per line.'}]} onSave={async()=>{}}/></LanguageProvider>);expect(screen.getByLabelText('តំណ Facebook / លទ្ធផលការងារ (អតិបរមា ១៥ តំណ)')).toBeInTheDocument();expect(screen.getByText('ដាក់បានរហូតដល់ ១៥ តំណ ដោយដាក់មួយតំណក្នុងមួយបន្ទាត់។')).toBeInTheDocument();expect(screen.queryByText(/\?{3}/)).not.toBeInTheDocument();});
 it('defaults to Khmer and uses a text status',()=>{render(<LanguageProvider><Badge value="Approved"/></LanguageProvider>);expect(screen.getByText('បានអនុម័ត')).toBeInTheDocument();});
 it('validates form values and does not submit invalid progress',async()=>{localStorage.setItem('workday-language-v1','en');const save=vi.fn();render(<LanguageProvider><DataForm fields={[{name:'progress',label:'Progress',type:'number'}]} initial={{progress:101}} schema={z.object({progress:z.coerce.number().min(0).max(100)})} onSave={save}/></LanguageProvider>);fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument());expect(save).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Progress'),{target:{value:'80'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(save).toHaveBeenCalledWith({progress:80}));});
 it('shows server errors without discarding entered values',async()=>{localStorage.setItem('workday-language-v1','en');render(<LanguageProvider><DataForm fields={[{name:'notes',label:'Notes'}]} initial={{notes:'Evidence'}} onSave={async()=>{throw new Error('Report is locked');}}/></LanguageProvider>);fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Report is locked'));expect(screen.getByLabelText('Notes')).toHaveValue('Evidence');});
 it('hides protected content without an authenticated session',()=>{render(<MemoryRouter><Guard><div>Private data</div></Guard></MemoryRouter>);expect(screen.queryByText('Private data')).not.toBeInTheDocument();});
 it('passes CSRF and credentials for mutations without token storage',async()=>{const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({csrf_token:'csrf-test'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({message:'ok'}),{status:200}));await api('/tasks/1/status','PATCH',{status:'Accepted'});expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/tasks/1/status',expect.objectContaining({credentials:'include',headers:expect.objectContaining({'X-CSRFToken':'csrf-test'})}));expect(localStorage.length).toBe(0);});
});
