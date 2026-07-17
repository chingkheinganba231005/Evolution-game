import React, { lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import './index.css';
import { App } from './app/App';
import { ErrorBoundary } from './components/ErrorBoundary';

const LandingPage = lazy(() => import('./app/routes/LandingPage').then((m) => ({ default: m.LandingPage })));
const LabPage = lazy(() => import('./app/routes/LabPage').then((m) => ({ default: m.LabPage })));
const ArenaPage = lazy(() => import('./app/routes/ArenaPage').then((m) => ({ default: m.ArenaPage })));
const GalleryPage = lazy(() => import('./app/routes/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const LearnPage = lazy(() => import('./app/routes/LearnPage').then((m) => ({ default: m.LearnPage })));
const SettingsPage = lazy(() => import('./app/routes/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'lab', element: <LabPage /> },
      { path: 'arena', element: <ArenaPage /> },
      { path: 'gallery', element: <GalleryPage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
