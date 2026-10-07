import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Shell } from './components/Shell';
import { ErrorBoundary } from './components/ui';
import { GuestProvider } from './state/GuestProvider';
import { AuthProvider, useAuth } from './state/AuthProvider';
import { CatalogProvider } from './state/CatalogProvider';
import { AuthPage } from './pages/AuthPage';
import type { ReactNode } from 'react';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { CollegeDetailPage } from './pages/CollegeDetailPage';
import { ComparePage } from './pages/ComparePage';
import { WorkspacePage } from './pages/WorkspacePage';
import { PreferencesPage } from './pages/PreferencesPage';
import { InfoPage } from './pages/InfoPage';
import { SourcesPage } from './pages/SourcesPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false } },
});
// The same preview can be opened as a standalone local HTML file without a server.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

function SessionWorkspace({ children }: {children: ReactNode}) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="connection-screen"><h1>Checking your session…</h1></div>;
  return <GuestProvider key={user?.id ?? 'guest'}>{children}</GuestProvider>;
}

export default function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><CatalogProvider><Router><AuthProvider><SessionWorkspace><Shell>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/colleges/:slug" element={<CollegeDetailPage />} />
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/workspace" element={<WorkspacePage />} />
      <Route path="/colleges" element={<Navigate to="/explore" replace />} />
      <Route path="/saved" element={<Navigate to="/workspace" replace />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/predictor" element={<InfoPage kind="retired" />} />
      <Route path="/discussions/*" element={<InfoPage kind="retired" />} />
      <Route path="*" element={<InfoPage />} />
    </Routes>
  </Shell></SessionWorkspace></AuthProvider></Router></CatalogProvider></QueryClientProvider></ErrorBoundary>;
}
