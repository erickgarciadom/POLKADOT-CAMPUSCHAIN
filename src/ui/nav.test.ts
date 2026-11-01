import { describe, expect, it } from 'vitest';
import { SECCIONES } from './nav';

describe('menú', () => {
  it('conserva las cinco secciones, en orden, con sus nombres y rutas', () => {
    expect(SECCIONES.map((s) => [s.id, s.href, s.etiqueta])).toEqual([
      ['catalogo', '#/', 'Catálogo'],
      ['pedidos', '#/pedidos', 'Mis pedidos'],
      ['vender', '#/vender', 'Vender'],
      ['ventas', '#/ventas', 'Ventas'],
      ['cuenta', '#/cuenta', 'Cuenta'],
    ]);
  });

  it('cada sección tiene su propio icono, solo con comandos de trazo SVG', () => {
    const trazos = SECCIONES.map((s) => s.trazo);
    expect(new Set(trazos).size).toBe(trazos.length);
    for (const t of trazos) expect(t).toMatch(/^M[0-9MLHVCSQTAZmlhvcsqtaz .,-]+$/);
  });
});
