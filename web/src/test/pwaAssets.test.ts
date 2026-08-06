import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PWA assets', () => {
  it('declares installable icons and keeps API network-only', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as { display: string; icons: unknown[] };
    const worker = readFileSync(resolve('public/sw.js'), 'utf8');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(3);
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain('event.respondWith(fetch(request))');
  });
});

