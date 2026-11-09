import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminBreadcrumbs } from './breadcrumbs';

// El pathname se cambia por test; next/navigation y next-intl necesitan un contexto de Next
// que aquí no existe, así que se sustituyen por versiones mínimas.
let mockPathname = '/admin/catalog';
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderHtml(pathname: string): string {
  mockPathname = pathname;
  return renderToStaticMarkup(<AdminBreadcrumbs />);
}

// Profundidad máxima de <li> anidados leyendo el HTML crudo. Hay que mirar la cadena y no el DOM:
// el parser del navegador cierra solo un <li> dentro de otro, y ocultaría justo el bug.
function maxLiDepth(html: string): number {
  let depth = 0;
  let max = 0;
  for (const tag of html.matchAll(/<(\/?)li[\s>]/g)) {
    depth += tag[1] ? -1 : 1;
    max = Math.max(max, depth);
  }
  return max;
}

describe('AdminBreadcrumbs', () => {
  it('no anida <li> dentro de <li> (regresión de hidratación)', () => {
    const html = renderHtml('/admin/catalog/products');

    expect(html).toContain('<li');
    expect(maxLiDepth(html)).toBe(1);
  });

  it('pone un separador entre migas y ninguno antes de la primera', () => {
    const container = document.createElement('div');
    container.innerHTML = renderHtml('/admin/catalog/products');

    const items = [...container.querySelectorAll('ol > li')];
    const separators = items.filter((li) => li.getAttribute('role') === 'presentation');
    // 3 migas (admin, catalog, products) → 2 separadores, y el primer hijo no es separador.
    expect(separators).toHaveLength(2);
    expect(items[0]?.getAttribute('role')).not.toBe('presentation');
  });

  it('no pinta nada con una sola miga', () => {
    expect(renderHtml('/admin')).toBe('');
  });
});
