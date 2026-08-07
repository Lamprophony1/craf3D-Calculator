import { useEffect, useState, type ReactNode } from 'react';
import { Calculator, ChartNoAxesCombined, ClipboardList, Gauge, Menu, Settings, Spool, X } from 'lucide-react';
import { APP_NAME, MASTER_LOGO_PATH } from '../config/app';
import type { AppUser } from '../api/types';

const primaryNav = [
  ['/', 'Cotizar', Calculator],
  ['/dashboard', 'Panel', Gauge],
  ['/calculator', 'Avanzada', Calculator],
  ['/quotes', 'Cotizaciones', ClipboardList],
  ['/jobs', 'Trabajos', Menu],
  ['/filaments', 'Filamentos', Spool],
  ['/reports', 'Reportes', ChartNoAxesCombined]
] as const;

const setupNav = [
  ['/settings', 'Configuración general'],
  ['/printers', 'Impresoras'], ['/energy-profiles', 'Energía'], ['/electricity-tariffs', 'Tarifas'],
  ['/customers', 'Clientes'], ['/product-templates', 'Plantillas'], ['/pricing-policies', 'Política de precios'],
  ['/audit', 'Auditoría'], ['/profile', 'Perfil']
] as const;

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AppShell({ user, path, appName, children, onLogout }: { user: AppUser; path: string; appName: string; children: ReactNode; onLogout: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [path]);
  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);
  const link = (href: string, label: string, Icon?: typeof Settings, close = false) => (
    <a key={href} href={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}
      onClick={(event) => { event.preventDefault(); if (close) setMoreOpen(false); navigate(href); }}>
      {Icon ? <Icon size={18} aria-hidden="true" /> : null}<span>{label}</span>
    </a>
  );
  return <div className="app-layout">
    <header className="app-header">
      <a href="/" className="brand" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
        <img src={MASTER_LOGO_PATH} alt="" /><span>{appName || APP_NAME}</span>
      </a>
      <div className="session"><span>{user.displayName}</span><button type="button" className="quiet" onClick={onLogout}>Salir</button></div>
    </header>
    <aside className="side-nav" aria-label="Navegación principal">
      <nav>{primaryNav.map(([href, label, Icon]) => link(href, label, Icon))}</nav>
      <p className="nav-label">Configuración</p>
      <nav>{setupNav.map(([href, label]) => link(href, label, Settings))}</nav>
    </aside>
    <main>{children}</main>
    <nav className="bottom-nav" aria-label="Navegación móvil">
      {primaryNav.slice(0, 4).map(([href, label, Icon]) => link(href, label, Icon))}
      <button type="button" className={moreOpen ? 'active' : ''} aria-label="Abrir más opciones" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen(open => !open)}><Menu size={18} aria-hidden="true" /><span>Más</span></button>
    </nav>
    {moreOpen ? <div className="mobile-drawer-backdrop" onClick={() => setMoreOpen(false)}>
      <section id="mobile-more-menu" className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Más opciones" onClick={event => event.stopPropagation()}>
        <header><h2>Más opciones</h2><button type="button" className="quiet" aria-label="Cerrar más opciones" onClick={() => setMoreOpen(false)}><X size={20} /></button></header>
        <nav>{primaryNav.slice(4).map(([href, label, Icon]) => link(href, label, Icon, true))}{setupNav.map(([href, label]) => link(href, label, Settings, true))}</nav>
        <button type="button" className="secondary drawer-logout" onClick={() => { setMoreOpen(false); onLogout(); }}>Cerrar sesión</button>
      </section>
    </div> : null}
  </div>;
}
