import React from 'react';
import {createRoot} from 'react-dom/client';
import {TutorialViewer} from './Viewer';

const rootElement=document.getElementById('root');
if(!rootElement) throw new Error('Viewer root element is missing');

createRoot(rootElement).render(
 <React.StrictMode>
  <TutorialViewer/>
 </React.StrictMode>,
);
