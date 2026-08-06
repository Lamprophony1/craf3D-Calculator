import type { ReactNode } from 'react';
import { Calculator, ChartNoAxesCombined, ClipboardList, Gauge, Menu, Settings, Spool } from 'lucide-react';
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
  const link = (href: string, label: string, Icon?: typeof Settings) => (
    <a key={href} href={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}
      onClick={(event) => { event.preventDefault(); navigate(href); }}>
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
    </nav>
  </div>;
}
