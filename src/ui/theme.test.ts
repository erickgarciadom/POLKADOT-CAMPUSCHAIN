import { describe, expect, it } from 'vitest';

// Vitest entrega los .css vacíos (también con ?raw), así que se lee el archivo con Node. Tipo mínimo
// aquí mismo: el proyecto no trae @types/node.
declare const process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } };
const css = process.getBuiltinModule('node:fs').readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/** Variables `--x: #rrggbb;` del primer bloque `:root { … }` a partir de `desde`. */
function tokens(desde: number): Record<string, string> {
  const start = css.indexOf(':root {', desde);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

const claro = tokens(0);
const oscuro = tokens(css.indexOf('@media (prefers-color-scheme: dark)'));

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
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['accent-ink', 'accent'], ['accent-text', 'accent-soft'], ['accent-text', 'bg'], ['accent-text', 'surface'],
  ['tag-ink', 'tag'],
  ['ok', 'ok-soft'], ['ok', 'surface'], ['warn', 'warn-soft'], ['bad', 'bad-soft'], ['bad', 'surface'], ['info', 'info-soft'],
  ['bg', 'text'],
];

describe('colores de styles.css', () => {
  for (const [nombre, t] of [['claro', claro], ['oscuro', oscuro]] as const) {
    it(`modo ${nombre}: define todos los colores`, () => {
      expect(Object.keys(t).length).toBeGreaterThanOrEqual(20);
      expect(Object.keys(t).sort()).toEqual(Object.keys(claro).sort());
    });
    for (const [texto, fondo] of PARES) {
      it(`modo ${nombre}: ${texto} sobre ${fondo} tiene contraste AA`, () => {
        expect(contraste(t[texto]!, t[fondo]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
