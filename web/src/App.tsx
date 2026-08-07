import { useEffect, useState } from 'react';
import { useAuthSession } from './auth/useAuthSession';
import { AppShell } from './components/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CalculatorScreen } from './screens/CalculatorScreen';
import { JobDetailScreen, JobListScreen, QuoteDetailScreen, QuoteListScreen } from './screens/ResourceScreens';
import { CatalogScreen, EnergyProfilesScreen, GeneralSettingsScreen } from './screens/CatalogScreens';
import { AuditScreen, ProfileScreen, ReportsScreen } from './screens/ReportsAndProfileScreens';
import { QuickQuoteScreen } from './screens/QuickQuoteScreen';
import { AdvancedSettingsScreen, SimpleSettingsScreen } from './screens/SimpleSettingsScreen';
import { FilamentsScreen } from './screens/FilamentsScreen';
import { get } from './api/client';
import type { SettingsResponse } from './api/types';
import { APP_NAME } from './config/app';

function usePath() {
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{const update=()=>setPath(window.location.pathname);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
  return path;
}

export function App() {
  const path=usePath(); const auth=useAuthSession();
  const [appName,setAppName]=useState(APP_NAME);
  useEffect(()=>{
    if(!auth.user)return;
    get<SettingsResponse>('/api/settings').then(response=>setAppName(response.settings.visibleAppName)).catch(()=>undefined);
    const update=(event:Event)=>setAppName((event as CustomEvent<string>).detail || APP_NAME);
    window.addEventListener('printcost:settings-updated',update);
    return()=>window.removeEventListener('printcost:settings-updated',update);
  },[auth.user]);
  useEffect(()=>{document.title=appName;},[appName]);
  if(auth.loading && !auth.user) return <main className="centered"><p>Cargando…</p></main>;
  if(!auth.user && auth.unverifiedOffline) return <div className="offline-app-shell"><header className="app-header"><strong>{APP_NAME}</strong><span>Sin sesión verificada</span></header><main><QuickQuoteScreen/></main></div>;
  if(!auth.user) return <LoginScreen options={auth.options} loading={auth.loading} error={auth.error} onLogin={auth.login}/>;
  let screen: React.ReactNode;
  if(path==='/') screen=<QuickQuoteScreen/>;
  else if(path==='/dashboard') screen=<DashboardScreen/>;
  else if(path==='/calculator') screen=<CalculatorScreen/>;
  else if(path==='/quotes/new') screen=<CalculatorScreen saveAsQuote/>;
  else if(path==='/quotes') screen=<QuoteListScreen/>;
  else if(path.startsWith('/quotes/')) screen=<QuoteDetailScreen id={path.split('/')[2] ?? ''}/>;
  else if(path==='/jobs') screen=<JobListScreen/>;
  else if(path.startsWith('/jobs/')) screen=<JobDetailScreen id={path.split('/')[2] ?? ''}/>;
  else if(path==='/energy-profiles') screen=<EnergyProfilesScreen/>;
  else if(path==='/filaments') screen=<FilamentsScreen/>;
  else if(path==='/settings') screen=<SimpleSettingsScreen/>;
  else if(path==='/settings/advanced') screen=<AdvancedSettingsScreen/>;
  else if(path==='/settings/advanced/filaments') screen=<CatalogScreen resource="filaments"/>;
  else if(path==='/settings/advanced/general') screen=<GeneralSettingsScreen/>;
  else if(path==='/reports') screen=<ReportsScreen/>;
  else if(path==='/audit') screen=<AuditScreen/>;
  else if(path==='/profile') screen=<ProfileScreen/>;
  else {
    const resource=path.slice(1);
    screen=['printers','filaments','electricity-tariffs','customers','product-templates','pricing-policies'].includes(resource)
      ? <CatalogScreen resource={resource}/>
      : <section className="page"><h1>Página no encontrada</h1></section>;
  }
  return <AppShell user={auth.user} path={path} appName={appName} onLogout={()=>void auth.logout()}>{screen}</AppShell>;
}
