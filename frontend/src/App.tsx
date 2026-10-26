import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api';
import { LanguageProvider } from './i18n';
import { ToastProvider } from './ui';
import { AuthProvider, Guard, LoginPage } from './auth';
import { Layout } from './layout';
import { Dashboard } from './dashboard';
import { TaskList, TaskDetails, TaskForm } from './tasks';
import { ReportList, ReportDetails, ReportForm } from './reports';
import { Employees, EmployeeForm, EmployeeDetails, Departments } from './people';
import { Analytics, Notifications, Settings, Audit, Missing } from './more';
const client=queryClient;
const managers=['super_admin','admin','manager'] as const;
export default function App() {return <QueryClientProvider client={client}><LanguageProvider><ToastProvider><AuthProvider><BrowserRouter><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/forgot-password" element={<LoginPage/>}/><Route path="/reset-password" element={<LoginPage/>}/><Route element={<Guard><Layout/></Guard>}><Route index element={<Dashboard/>}/><Route path="tasks" element={<TaskList/>}/><Route path="tasks/new" element={<Guard roles={[...managers]}><TaskForm/></Guard>}/><Route path="tasks/:id/edit" element={<Guard roles={[...managers]}><TaskForm/></Guard>}/><Route path="tasks/:id" element={<TaskDetails/>}/><Route path="reports" element={<ReportList/>}/><Route path="reports/new" element={<ReportForm/>}/><Route path="reports/:id/edit" element={<ReportForm/>}/><Route path="reports/:id" element={<ReportDetails/>}/><Route path="approvals" element={<Guard roles={[...managers]}><ReportList approval/></Guard>}/><Route path="employees" element={<Guard roles={[...managers]}><Employees/></Guard>}/><Route path="employees/new" element={<Guard roles={['super_admin']}><EmployeeForm/></Guard>}/><Route path="employees/:id/edit" element={<Guard roles={['super_admin']}><EmployeeForm/></Guard>}/><Route path="employees/:id" element={<Guard roles={[...managers]}><EmployeeDetails/></Guard>}/><Route path="departments" element={<Guard roles={[...managers]}><Departments/></Guard>}/><Route path="analytics" element={<Analytics/>}/><Route path="notifications" element={<Notifications/>}/><Route path="settings" element={<Settings/>}/><Route path="audit" element={<Guard roles={['super_admin']}><Audit/></Guard>}/><Route path="access-denied" element={<Missing denied/>}/><Route path="*" element={<Missing/>}/></Route></Routes></BrowserRouter></AuthProvider></ToastProvider></LanguageProvider></QueryClientProvider>;}
