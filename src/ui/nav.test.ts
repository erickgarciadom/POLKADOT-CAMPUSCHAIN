import { describe, expect, it } from 'vitest';
import { rutaDe, SECCIONES } from './nav';

const PEDIDO = `0x${'ab'.repeat(32)}`;
const VENDEDOR = `0x${'cd'.repeat(20)}`;

describe('rutas', () => {
  it.each([
    ['', { vista: 'catalogo', tab: 'catalogo' }],
    ['#/', { vista: 'catalogo', tab: 'catalogo' }],
    ['#/p/12', { vista: 'producto', tab: 'catalogo', id: '12' }],
    [`#/o/${PEDIDO}`, { vista: 'pedido', tab: 'pedidos', id: PEDIDO }],
    [`#/v/${VENDEDOR}`, { vista: 'vendedor', tab: 'catalogo', id: VENDEDOR }],
    ['#/pedidos', { vista: 'pedidos', tab: 'pedidos' }],
    ['#/vender', { vista: 'vender', tab: 'vender' }],
    ['#/ventas', { vista: 'ventas', tab: 'ventas' }],
    ['#/cuenta', { vista: 'cuenta', tab: 'cuenta' }],
  ])('%s → su pantalla', (hash, ruta) => {
    expect(rutaDe(hash)).toEqual(ruta);
  });

  it('un id con formato inválido cae en el catálogo, sin leer el contrato', () => {
    for (const hash of ['#/p/abc', '#/o/0x12', `#/v/${VENDEDOR}00`, '#/otra']) {
      expect(rutaDe(hash)).toEqual({ vista: 'catalogo', tab: 'catalogo' });
    }
  });
});

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
