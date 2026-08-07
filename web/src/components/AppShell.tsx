import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Calculator,
  ClipboardList,
  Gauge,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  Settings,
  Spool,
  UserRound,
  X
} from 'lucide-react';
import { APP_NAME, MASTER_LOGO_PATH } from '../config/app';
import type { AppUser } from '../api/types';

const dailyNav = [
  ['/', 'Cotizar', Calculator],
  ['/quotes', 'Presupuestos', ClipboardList],
  ['/jobs', 'Pedidos', PackageCheck],
  ['/filaments', 'Filamentos', Spool],
  ['/settings', 'Ajustes', Settings]
] as const;

const mobileNav = dailyNav.filter(([href]) => ['/', '/quotes', '/filaments'].includes(href));

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function TypeUiPanel() {
  const [minimized, setMinimized] = useState(false);
  const expandedStyle = {
    position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 2147483647,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px',
    background: 'rgba(0,0,0,.5)', color: '#fff', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 9999, font: '500 14px/20px system-ui,sans-serif', boxShadow: '0 10px 24px rgba(0,0,0,.25)',
    whiteSpace: 'nowrap'
  } as const;
  const minimizedStyle = {
    position: 'fixed', right: 24, bottom: 24, left: 'auto', transform: 'none', zIndex: 2147483647,
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, padding: 0,
    background: 'rgba(0,0,0,.5)', color: '#fff', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 9999, font: '500 14px/20px system-ui,sans-serif', boxShadow: '0 10px 24px rgba(0,0,0,.25)',
    whiteSpace: 'nowrap'
  } as const;
  if (minimized) return <div style={minimizedStyle}>
    <button type="button" aria-label="Maximize TypeUI panel" onClick={() => setMinimized(false)} style={{ all: 'unset', width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
      <img src="https://www.typeui.sh/logo.svg" alt="TypeUI" width="18" height="18" />
    </button>
  </div>;
  return <div style={expandedStyle}>
    <img src="https://www.typeui.sh/logo.svg" alt="TypeUI" width="18" height="18" />
    <span>TypeUI</span>
    <button type="button" aria-label="Minimize TypeUI panel" onClick={() => setMinimized(true)} style={{ width: 44, height: 44, minHeight: 44, padding: 0, border: '2px solid #fff', background: 'transparent', color: '#fff', cursor: 'pointer' }}>−</button>
  </div>;
}

export function AppShell({ user, path, appName, children, onLogout }: { user: AppUser; path: string; appName: string; children: ReactNode; onLogout: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const lastMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMoreOpen(false), [path]);
  useEffect(() => {
    if (!moreOpen) return;
    const drawer = drawerRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMoreOpen(false); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); lastMenuTriggerRef.current?.focus(); };
  }, [moreOpen]);

  const isActive = (href: string) => path === href || (href !== '/' && path.startsWith(`${href}/`));
  const link = (href: string, label: string, Icon: typeof Settings, close = false) => (
    <a key={href} href={href} className={isActive(href) ? 'active' : ''} aria-current={isActive(href) ? 'page' : undefined}
      onClick={(event) => { event.preventDefault(); if (close) setMoreOpen(false); navigate(href); }}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>
    </a>
  );

  return <div className={`app-layout ${navigationCollapsed ? 'nav-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <header className="app-header">
      <button type="button" className="icon-button shell-menu" aria-label="Alternar navegación" aria-expanded={!navigationCollapsed}
        onClick={(event) => { lastMenuTriggerRef.current = event.currentTarget; window.matchMedia('(max-width: 900px)').matches ? setMoreOpen(true) : setNavigationCollapsed(value => !value); }}>
        <Menu size={22} aria-hidden="true" />
      </button>
      <a href="/" className="brand" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
        <img src={MASTER_LOGO_PATH} alt="" /><span>{appName || APP_NAME}</span>
      </a>
      <div className="header-actions">
        <button type="button" className="header-quote-action" onClick={() => navigate('/')}><Plus size={18} aria-hidden="true" />Cotizar</button>
        <span className="user-name">{user.displayName}</span>
        <button type="button" className="quiet logout-action" onClick={onLogout}><LogOut size={18} aria-hidden="true" /><span>Salir</span></button>
      </div>
    </header>

    <aside className="side-nav">
      <nav aria-label="Navegación principal">{dailyNav.map(([href, label, Icon]) => link(href, label, Icon))}</nav>
      <nav className="side-utility" aria-label="Accesos secundarios">
        {link('/dashboard', 'Resumen', Gauge)}
        {link('/profile', 'Perfil', UserRound)}
      </nav>
    </aside>

    <main id="main-content" tabIndex={-1}>{children}</main>

    <aside className="right-rail" aria-label="Accesos rápidos">
      <button type="button" className="icon-button" title="Resumen" aria-label="Abrir resumen" onClick={() => navigate('/dashboard')}><Gauge size={20} aria-hidden="true" /></button>
      <button type="button" className="icon-button" title="Perfil" aria-label="Abrir perfil" onClick={() => navigate('/profile')}><UserRound size={20} aria-hidden="true" /></button>
      <button type="button" className="icon-button" title="Ajustes" aria-label="Abrir ajustes" onClick={() => navigate('/settings')}><Settings size={20} aria-hidden="true" /></button>
    </aside>

    <nav className="bottom-nav" aria-label="Navegación móvil">
      {mobileNav.map(([href, label, Icon]) => link(href, label, Icon))}
      <button type="button" className={moreOpen ? 'active' : ''} aria-label="Abrir más opciones" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={(event) => { lastMenuTriggerRef.current = event.currentTarget; setMoreOpen(true); }}>
        <Menu size={20} aria-hidden="true" /><span>Más</span>
      </button>
    </nav>

    {moreOpen ? <div className="mobile-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setMoreOpen(false); }}>
      <section ref={drawerRef} id="mobile-more-menu" className="mobile-drawer" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
        <header><h2 id="mobile-more-title">Más</h2><button type="button" className="icon-button" aria-label="Cerrar más opciones" onClick={() => setMoreOpen(false)}><X size={22} aria-hidden="true" /></button></header>
        <nav>
          {link('/jobs', 'Pedidos', PackageCheck, true)}
          {link('/settings', 'Ajustes', Settings, true)}
          {link('/profile', 'Perfil', UserRound, true)}
          {link('/settings/advanced', 'Configuración avanzada', Settings, true)}
        </nav>
        <button type="button" className="secondary drawer-logout" onClick={() => { setMoreOpen(false); onLogout(); }}><LogOut size={18} aria-hidden="true" />Cerrar sesión</button>
      </section>
    </div> : null}
    <TypeUiPanel />
  </div>;
}
