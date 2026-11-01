import { describe, expect, it } from 'vitest';

// Se leen los archivos con Node. Tipo mínimo aquí mismo: el proyecto no trae @types/node.
declare const process: {
  getBuiltinModule(id: 'node:fs'): {
    readdirSync(path: URL, options: { recursive: true }): string[];
    readFileSync(path: URL, encoding: 'utf8'): string;
  };
};
const fs = process.getBuiltinModule('node:fs');
const UI = new URL('./', import.meta.url);

/** Pantallas y partes de la interfaz (src/ui), sin los tests. */
const archivos = fs.readdirSync(UI, { recursive: true })
  .map((f) => f.replaceAll('\\', '/'))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

// Emojis y los símbolos que se usaban como iconos. Las flechas → de los comentarios no cuentan.
const PROHIBIDO = /[\p{Extended_Pictographic}\u{FE0F}●○✓✗←]/u;

describe('la interfaz no usa emojis', () => {
  it('encuentra los archivos de src/ui', () => {
    expect(archivos).toContain('app.ts');
    expect(archivos).toContain('pages/catalog.ts');
  });

  it.each(archivos)('%s', (archivo) => {
    const lineas = fs.readFileSync(new URL(archivo, UI), 'utf8').split('\n');
    const conEmoji = lineas.flatMap((l, i) => (PROHIBIDO.test(l) ? [`${i + 1}: ${l.trim()}`] : []));
    expect(conEmoji).toEqual([]);
  });
});
