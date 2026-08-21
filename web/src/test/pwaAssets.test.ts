import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PWA assets', () => {
  it('declares installable icons and keeps API network-only', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as { display: string; icons: unknown[] };
    const worker = readFileSync(resolve('public/sw.js'), 'utf8');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(3);
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain('event.respondWith(fetch(request))');
    expect(worker).toContain("printcost-shell-v3");
    const shell = worker.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] ?? '';
    expect(shell).not.toContain('/media/portacelular/');
  });

  it('no carga recursos ni paneles TypeUI en runtime', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const runtimeFiles = [
      app,
      readFileSync(resolve('src/components/AppShell.tsx'), 'utf8'),
      readFileSync(resolve('public/sw.js'), 'utf8'),
      readFileSync(resolve('public/manifest.webmanifest'), 'utf8'),
      readFileSync(resolve('index.html'), 'utf8')
    ].join('\n').toLowerCase();
    expect(runtimeFiles).not.toContain(['typeui', 'panel'].join(''));
    expect(runtimeFiles).not.toContain('typeui.io');
    expect(app).toContain("path==='/settings/advanced/filaments'");
    expect(app).toContain('<CatalogScreen resource="filaments"/>');
  });

  it('mantiene la dirección visual sin radios, sombras ni tipografía ajena', () => {
    const stylesDirectory = resolve('src/styles');
    const entryCss = readFileSync(resolve('src/styles.css'), 'utf8');
    const css = [entryCss, ...readdirSync(stylesDirectory)
      .filter(name => name.endsWith('.css'))
      .map(name => readFileSync(resolve(stylesDirectory, name), 'utf8'))].join('\n');
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;]+);/gi)].map(match => match[1].trim());
    const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;]+);/gi)].map(match => match[1].trim());
    expect(radii.every(value => /^0(?:\s*!important)?$/i.test(value))).toBe(true);
    expect(shadows.every(value => /^none(?:\s*!important)?$/i.test(value))).toBe(true);
    expect(css).not.toMatch(/\bInter\b|typeui\.io|height\s*:\s*540px/i);
    const imports = [...entryCss.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
    expect(new Set(imports).size).toBe(imports.length);
    const main = readFileSync(resolve('src/main.tsx'), 'utf8');
    expect(main.match(/import ['"]\.\/styles\.css['"]/g)).toHaveLength(1);
    expect(main).not.toMatch(/import ['"]\.\/styles\//);
  });
});
