import { useEffect, useState } from 'react';
import { useAuthSession } from './auth/useAuthSession';
import { AppShell } from './components/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CalculatorScreen } from './screens/CalculatorScreen';
import { JobDetailScreen, JobListScreen, QuoteDetailScreen, QuoteListScreen } from './screens/ResourceScreens';
import { CatalogScreen, EnergyProfilesScreen } from './screens/CatalogScreens';
import { AuditScreen, ProfileScreen, ReportsScreen } from './screens/ReportsAndProfileScreens';

function usePath() {
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{const update=()=>setPath(window.location.pathname);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
  return path;
}

export function App() {
  const path=usePath(); const auth=useAuthSession();
  if(auth.loading && !auth.user) return <main className="centered"><p>Cargando…</p></main>;
  if(!auth.user) return <LoginScreen options={auth.options} loading={auth.loading} error={auth.error} onLogin={auth.login}/>;
  let screen: React.ReactNode;
  if(path==='/') screen=<DashboardScreen/>;
  else if(path==='/calculator') screen=<CalculatorScreen/>;
  else if(path==='/quotes/new') screen=<CalculatorScreen saveAsQuote/>;
  else if(path==='/quotes') screen=<QuoteListScreen/>;
  else if(path.startsWith('/quotes/')) screen=<QuoteDetailScreen id={path.split('/')[2] ?? ''}/>;
  else if(path==='/jobs') screen=<JobListScreen/>;
  else if(path.startsWith('/jobs/')) screen=<JobDetailScreen id={path.split('/')[2] ?? ''}/>;
  else if(path==='/energy-profiles') screen=<EnergyProfilesScreen/>;
  else if(path==='/reports') screen=<ReportsScreen/>;
  else if(path==='/audit') screen=<AuditScreen/>;
  else if(path==='/profile') screen=<ProfileScreen/>;
  else {
    const resource=path.slice(1);
    screen=['printers','filaments','electricity-tariffs','customers','product-templates','pricing-policies'].includes(resource)
      ? <CatalogScreen resource={resource}/>
      : <section className="page"><h1>Página no encontrada</h1></section>;
  }
  return <AppShell user={auth.user} path={path} onLogout={()=>void auth.logout()}>{screen}</AppShell>;
}

