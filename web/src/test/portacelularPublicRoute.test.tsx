import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('ruta pública del portacelular', () => {
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

    expect(screen.getByRole('heading', {
      level: 1,
      name: 'De llavero a portacelular. Y todavía tiene un truco más.'
    })).toBeInTheDocument();
    expect(container.querySelector('.public-product-page')).toBeInTheDocument();
    expect(container.querySelector('.login-page')).not.toBeInTheDocument();
    expect(container.querySelector('.app-layout')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('muestra el contenido, placeholders, branding y enlaces públicos exactos', () => {
    window.history.replaceState({}, '', '/portacelular');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('La página estática no debe depender de fetch.');
    }));

    const { container } = render(<App />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Montalo en segundos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'También es una ruedita antiestrés' })).toBeInTheDocument();
    expect(screen.getByText('Video de montaje en preparación')).toBeInTheDocument();
    expect(screen.getByText('Video de la ruedita antiestrés en preparación')).toBeInTheDocument();
    for (const instruction of [
      'Abrí el soporte.',
      'Acomodá la posición.',
      'Apoyá tu celular.',
      'Sostené la pieza con comodidad.',
      'Apoyá el pulgar sobre la ruedita.',
      'Girala suavemente a tu ritmo.'
    ]) expect(screen.getByText(instruction)).toBeInTheDocument();

    const logo = screen.getByRole('img', { name: 'Logo de CRAF 3D' });
    expect(logo).toHaveAttribute('src', '/branding/logo-master.jpg');

    const whatsapp = screen.getByRole('link', { name: 'Consultar por WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', WHATSAPP_URL);
    expectSafeExternalLink(whatsapp);

    const instagramLinks = screen.getAllByRole('link').filter(link => link.getAttribute('href') === INSTAGRAM_URL);
    expect(instagramLinks).toHaveLength(3);
    for (const link of instagramLinks) expectSafeExternalLink(link);

    expect(container.querySelectorAll('video[src=""], video source[src=""]')).toHaveLength(0);
    expect(container).not.toHaveTextContent(/\bLeonardo\b|\bcumple(?:años)?\b|superh[eé]roes?|invitaci[oó]n|evento específico|temática infantil/i);
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

  it('moves focus to both internal-link destinations', () => {
    window.history.replaceState({}, '', '/portacelular');
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      const { container } = render(<App />);
      const main = container.querySelector('main#main-content');
      const mountingSection = document.getElementById('modo-portacelular');
      const brandSection = document.getElementById('marca-craf3d');
      const mountingLink = container.querySelector<HTMLAnchorElement>('a[href="#modo-portacelular"]');
      const brandLink = container.querySelector<HTMLAnchorElement>('a[href="#marca-craf3d"]');

      expect(main).toHaveAttribute('tabindex', '-1');
      expect(mountingSection).toHaveAttribute('tabindex', '-1');
      expect(brandSection).toHaveAttribute('tabindex', '-1');
      expect(mountingLink).not.toBeNull();
      expect(brandLink).not.toBeNull();

      fireEvent.click(mountingLink!);
      expect(document.activeElement).toBe(mountingSection);
      expect(window.location.hash).toBe('#modo-portacelular');

      fireEvent.click(brandLink!);
      expect(document.activeElement).toBe(brandSection);
      expect(window.location.hash).toBe('#marca-craf3d');
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      HTMLElement.prototype.scrollIntoView = previousScrollIntoView;
    }
  });

  it('keeps every public class selector scoped to the page root', () => {
    const css = readFileSync(resolve('src/styles/public-product.css'), 'utf8');
    const publicSelectorLines = css
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('.'));

    expect(publicSelectorLines.length).toBeGreaterThan(0);
    expect(publicSelectorLines.filter(line => !line.startsWith('.public-product-page'))).toEqual([]);
    expect(css).toContain('@media (min-width: 64rem)');
    expect(css).not.toContain('@media (min-width: 56rem)');
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
