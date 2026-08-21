import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const PRIVATE_METADATA = {
  title: 'Calculadora 3D',
  description: 'Costos, presupuestos y rentabilidad de impresiones 3D.',
  themeColor: '#9f3500'
};

const PUBLIC_METADATA = {
  title: 'Portacelular 2 en 1 | CRAF 3D',
  description: 'Aprendé a montar el portacelular personalizado de CRAF 3D y descubrí su ruedita antiestrés.',
  themeColor: '#9f3500'
};

const MOUNTING_GIF = '/media/portacelular/montaje-portacelular.gif';
const ANTISTRESS_GIF = '/media/portacelular/rueda-antistres.gif';
const MOUNTING_STATIC = '/media/portacelular/montaje-portacelular-static.jpg';
const MOUNTING_ALT = 'Secuencia que muestra cómo abrir el llavero y usarlo como portacelular';
const ANTISTRESS_ALT = 'Secuencia que muestra el movimiento de la ruedita antiestrés';
const INSTAGRAM_URL = 'https://www.instagram.com/craf.3d/';
const WHATSAPP_URL = 'https://wa.me/595973427508?text=Hola%20CRAF%203D%2C%20vi%20el%20portacelular%20y%20quiero%20consultar%20por%20un%20producto%20personalizado.';

function meta(name: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  return element;
}

function setPrivateMetadata() {
  document.title = PRIVATE_METADATA.title;
  meta('description').content = PRIVATE_METADATA.description;
  meta('theme-color').content = PRIVATE_METADATA.themeColor;
}

function requestedPath(input: RequestInfo | URL) {
  return new URL(String(input), window.location.origin).pathname;
}

function expectSafeExternalLink(link: HTMLElement) {
  expect(link).toHaveAttribute('target', '_blank');
  const relTokens = link.getAttribute('rel')?.split(/\s+/) ?? [];
  expect(relTokens).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
}

describe('ruta pública compacta del portacelular', () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    setPrivateMetadata();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
    setPrivateMetadata();
  });

  it('resuelve /portacelular antes de montar autenticación o consultar la API', () => {
    window.history.replaceState({}, '', '/portacelular');
    const fetchMock = vi.fn(async () => {
      throw new Error('La ruta pública no debe ejecutar fetch.');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Tu llavero tiene dos modos' })).toBeInTheDocument();
    expect(container.querySelector('.public-product-page')).toBeInTheDocument();
    expect(container.querySelector('.login-page')).not.toBeInTheDocument();
    expect(container.querySelector('.app-layout')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renderiza solamente los dos GIF configurados con dimensiones y estrategia de carga explícitas', () => {
    window.history.replaceState({}, '', '/portacelular');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('La página estática no debe depender de fetch.');
    }));

    const { container } = render(<App />);
    const mountingGif = screen.getByRole('img', { name: MOUNTING_ALT });
    const antistressGif = screen.getByRole('img', { name: ANTISTRESS_ALT });

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Abrilo y apoyá tu celular' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Girá la ruedita con el pulgar' })).toBeInTheDocument();
    expect(container.querySelectorAll('.public-product-gif-section')).toHaveLength(2);
    expect(container.querySelectorAll('.public-product-gif-frame')).toHaveLength(2);

    expect(mountingGif).toHaveAttribute('src', MOUNTING_GIF);
    expect(mountingGif).toHaveAttribute('width', '600');
    expect(mountingGif).toHaveAttribute('height', '800');
    expect(mountingGif).toHaveAttribute('loading', 'eager');
    expect(mountingGif).toHaveAttribute('decoding', 'async');
    expect(mountingGif).toHaveAttribute('fetchpriority', 'high');

    expect(antistressGif).toHaveAttribute('src', ANTISTRESS_GIF);
    expect(antistressGif).toHaveAttribute('width', '600');
    expect(antistressGif).toHaveAttribute('height', '800');
    expect(antistressGif).toHaveAttribute('loading', 'lazy');
    expect(antistressGif).toHaveAttribute('decoding', 'async');
    expect(antistressGif).not.toHaveAttribute('fetchpriority', 'high');

    expect(container.querySelectorAll(`img[src="${MOUNTING_GIF}"]`)).toHaveLength(1);
    expect(container.querySelectorAll(`img[src="${ANTISTRESS_GIF}"]`)).toHaveLength(1);
    expect(container.querySelectorAll('main img')).toHaveLength(2);
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });

  it('mantiene las instrucciones accesibles, cerradas por defecto y sin el contenido largo anterior', () => {
    window.history.replaceState({}, '', '/portacelular');
    const { container } = render(<App />);

    const summaries = screen.getAllByText('Ver pasos en texto', { exact: true });
    expect(summaries).toHaveLength(2);
    for (const summary of summaries) {
      const details = summary.closest('details');
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute('open');
      expect(details!.textContent!.trim().length).toBeGreaterThan(summary.textContent!.trim().length);
    }

    expect(screen.queryByText('Video de montaje en preparación')).not.toBeInTheDocument();
    expect(screen.queryByText('Video de la ruedita antiestrés en preparación')).not.toBeInTheDocument();
    expect(screen.queryByText('Diseñado para ser distinto')).not.toBeInTheDocument();
    for (const obsoleteAttribute of ['Personalizable', 'Impreso en 3D', 'Hecho a medida']) {
      expect(screen.queryByText(obsoleteAttribute, { exact: true })).not.toBeInTheDocument();
    }
    expect(container.querySelector('.public-product-modes')).not.toBeInTheDocument();
    expect(container.querySelector('.public-product-story')).not.toBeInTheDocument();
    expect(container.querySelector('.public-product-attributes')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/\btratar\b|\bansiedad\b|\bterapia\b|\bclínico\b/i);

    const header = container.querySelector('.public-product-header');
    expect(header).not.toBeNull();
    expect(header!.querySelector(`a[href="${INSTAGRAM_URL}"]`)).not.toBeInTheDocument();
  });

  it('conserva el fallback compacto si falla un GIF sin perder las instrucciones', () => {
    window.history.replaceState({}, '', '/portacelular');
    const { container } = render(<App />);
    const mountingGif = screen.getByRole('img', { name: MOUNTING_ALT });
    const section = mountingGif.closest('.public-product-gif-section');

    expect(section).not.toBeNull();
    fireEvent.error(mountingGif);

    expect(screen.queryByRole('img', { name: MOUNTING_ALT })).not.toBeInTheDocument();
    expect(section!.querySelector('.public-product-gif-fallback')).toBeInTheDocument();
    expect(section!.querySelector('.public-product-gif-fallback')!.textContent?.trim().length).toBeGreaterThan(0);
    expect(container.querySelectorAll('details')).toHaveLength(2);
    expect(screen.getAllByText('Ver pasos en texto', { exact: true })).toHaveLength(2);
  });

  it('permite pausar y reanudar cada animación sin duplicar la superficie multimedia', () => {
    window.history.replaceState({}, '', '/portacelular');
    const { container } = render(<App />);
    const pause = screen.getByRole('button', { name: 'Pausar animación: Abrilo y apoyá tu celular' });

    expect(pause).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pause);

    const resume = screen.getByRole('button', { name: 'Reproducir animación: Abrilo y apoyá tu celular' });
    expect(resume).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: MOUNTING_ALT })).toHaveAttribute('src', MOUNTING_STATIC);
    expect(container.querySelectorAll('#modo-portacelular img')).toHaveLength(1);

    fireEvent.click(resume);
    expect(screen.getByRole('img', { name: MOUNTING_ALT })).toHaveAttribute('src', MOUNTING_GIF);
    expect(container.querySelectorAll('#modo-portacelular img')).toHaveLength(1);
  });

  it('mantiene una única conversión comercial al final y los enlaces externos exactos', () => {
    window.history.replaceState({}, '', '/portacelular');
    const { container } = render(<App />);
    const cta = container.querySelector<HTMLElement>('.public-product-final-cta');
    const footer = container.querySelector<HTMLElement>('.public-product-footer');

    expect(cta).not.toBeNull();
    expect(footer).not.toBeNull();

    const whatsapp = within(cta!).getByRole('link', { name: 'Quiero uno personalizado' });
    const ctaInstagram = within(cta!).getByRole('link', { name: 'Ver más trabajos' });
    const footerInstagram = within(footer!).getByRole('link', { name: /@craf\.3d/i });

    expect(whatsapp).toHaveAttribute('href', WHATSAPP_URL);
    expect(ctaInstagram).toHaveAttribute('href', INSTAGRAM_URL);
    expect(footerInstagram).toHaveAttribute('href', INSTAGRAM_URL);
    expectSafeExternalLink(whatsapp);
    expectSafeExternalLink(ctaInstagram);
    expectSafeExternalLink(footerInstagram);
  });

  it('aplica los metadatos públicos y restaura los privados al desmontarse', () => {
    window.history.replaceState({}, '', '/portacelular');

    const view = render(<App />);

    expect(document.title).toBe(PUBLIC_METADATA.title);
    expect(meta('description')).toHaveAttribute('content', PUBLIC_METADATA.description);
    expect(meta('theme-color')).toHaveAttribute('content', PUBLIC_METADATA.themeColor);

    view.unmount();

    expect(document.title).toBe(PRIVATE_METADATA.title);
    expect(meta('description')).toHaveAttribute('content', PRIVATE_METADATA.description);
    expect(meta('theme-color')).toHaveAttribute('content', PRIVATE_METADATA.themeColor);
  });

  it('mantiene cada selector público scopeado y elimina los estilos editoriales obsoletos', () => {
    const css = readFileSync(resolve('src/styles/public-product.css'), 'utf8');
    const publicSelectorLines = css
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('.'));

    expect(publicSelectorLines.length).toBeGreaterThan(0);
    expect(publicSelectorLines.filter(line => !line.startsWith('.public-product-page'))).toEqual([]);
    for (const obsoleteSelector of [
      '.public-product-hero-visual',
      '.public-product-modes',
      '.public-product-mode-link',
      '.public-product-scene-marker',
      '.public-product-video-section',
      '.public-product-video-placeholder',
      '.public-product-story',
      '.public-product-attributes',
      '.public-product-attribute'
    ]) expect(css).not.toContain(obsoleteSelector);
  });

  it('mantiene la raíz privada detrás del inicio de sesión', async () => {
    window.history.replaceState({}, '', '/');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = requestedPath(input);
      if (path === '/api/auth/login-options') {
        return new Response(JSON.stringify([{ id: 'user-1', username: 'rafa', displayName: 'Rafa' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (path === '/api/auth/me') {
        return new Response('{}', {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`Request privada inesperada: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Calculadora 3D' })).toBeInTheDocument();
    expect(screen.getByLabelText('PIN')).toBeInTheDocument();
    expect(container.querySelector('.login-page')).toBeInTheDocument();
    expect(container.querySelector('.public-product-page')).not.toBeInTheDocument();
    expect(container.querySelector('.app-layout')).not.toBeInTheDocument();

    const paths = fetchMock.mock.calls.map(([input]) => requestedPath(input));
    expect(paths).toEqual(expect.arrayContaining(['/api/auth/login-options', '/api/auth/me']));
    expect(paths).not.toContain('/api/settings');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
