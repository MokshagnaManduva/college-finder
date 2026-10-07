import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCatalog } from '../api';
import type { College } from '../types';
import { Compass } from 'lucide-react';

interface Catalog { colleges: College[]; states: string[]; degrees: string[] }
const Context = createContext<Catalog | null>(null);

export function CatalogProvider({ children }: {children: ReactNode}) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['catalog'], queryFn: getCatalog, staleTime: 60000,
  });
  if (isPending) return <div className="connection-screen"><Compass size={35} /><h1>Finding your options…</h1><p>Loading the college directory.</p></div>;
  if (isError) return <div className="connection-screen"><Compass size={35} /><h1>Let's reconnect.</h1><p>{error.message}</p><button className="button primary" onClick={() => refetch()}>Try again</button></div>;
  return <Context.Provider value={{
    colleges: data,
    states: [...new Set(data.map(college => college.state))].sort(),
    degrees: [...new Set(data.flatMap(college => college.courses.map(course => course.degree)))].sort(),
  }}>{children}</Context.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCatalog() {
  const context = useContext(Context);
  if (!context) throw new Error('CatalogProvider is required');
  return context;
}
