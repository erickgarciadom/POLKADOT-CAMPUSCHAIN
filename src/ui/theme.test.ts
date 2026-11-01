import { describe, expect, it } from 'vitest';

// Vitest entrega los .css vacíos (también con ?raw), así que se lee el archivo con Node. Tipo mínimo
// aquí mismo: el proyecto no trae @types/node.
declare const process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } };
const css = process.getBuiltinModule('node:fs').readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/** Variables `--x: #rrggbb;` del bloque `:root { … }`. */
const start = css.indexOf(':root {');
const t: Record<string, string> = Object.fromEntries(
  [...css.slice(start, css.indexOf('}', start)).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]),
);

// WCAG 2.1: luminancia relativa y razón de contraste.
const canal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

/** Texto sobre fondo que la interfaz usa de verdad. Todos con AA para texto normal (4.5:1). */
const PARES: [texto: string, fondo: string][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'],
  ['muted', 'bg'], ['muted', 'surface'],
  ['accent-ink', 'accent'], ['accent', 'bg'], ['accent', 'surface'],
  ['alert-ink', 'alert'], ['alert', 'bg'], ['alert', 'surface'],
  ['icon-ink', 'icon'], ['icon', 'bg'], ['icon', 'surface'], ['icon', 'surface-2'], ['icon', 'icon-soft'],
];

describe('colores de styles.css', () => {
  it('usa la paleta acordada', () => {
    expect(t).toMatchObject({
      bg: '#140c2e', // fondo principal
      surface: '#1e153d', // tarjetas y bloques
      accent: '#ffa959', // comprar/vender y saldos
      alert: '#ff6b2c', // alertas y acciones rápidas
      icon: '#a28bfa', // iconos y badges
      text: '#ffffff', // títulos y precios
      muted: '#8b82a8', // descripciones secundarias
    });
  });

  for (const [texto, fondo] of PARES) {
    it(`${texto} sobre ${fondo} tiene contraste AA`, () => {
      expect(contraste(t[texto]!, t[fondo]!)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('el menú va en una columna a la izquierda del contenido', () => {
    const areas = [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)].map((m) => m[1]!);
    expect(areas).toContain('"top top" "side banner" "side main"');
    expect(areas.some((a) => /main side|banner side/.test(a))).toBe(false);
  });

  it('la cuadrícula con menú solo aplica a la app montada, no al registro ni a la carga', () => {
    expect(css).toMatch(/#app\.marco\s*\{[^}]*display:\s*grid/);
    expect(css).not.toMatch(/#app\s*\{[^}]*display:\s*grid/);
  });

  it('la fuente es Plus Jakarta Sans, desde un archivo del bundle', () => {
    expect(css).toMatch(/--font:\s*"Plus Jakarta Sans"/);
    expect(css).toMatch(/url\("\.\/fonts\/plus-jakarta-sans-[\w-]+\.woff2"\)/);
    expect(css).not.toMatch(/url\(["']?https?:/);
    expect(css).not.toMatch(/@import/);
  });
});
