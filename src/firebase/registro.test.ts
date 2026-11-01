import { describe, expect, it } from 'vitest';
import { esCorreoUanl, normalizarCorreo, validarCredenciales } from './registro';

describe('correo institucional', () => {
  it('acepta solo @uanl.edu.mx, sin importar mayúsculas ni espacios alrededor', () => {
    expect(esCorreoUanl('ana.lopez@uanl.edu.mx')).toBe(true);
    expect(esCorreoUanl('  Ana.Lopez@UANL.edu.mx ')).toBe(true);
    expect(normalizarCorreo('  Ana@UANL.edu.mx ')).toBe('ana@uanl.edu.mx');
  });

  it('rechaza otros dominios y correos mal formados', () => {
    expect(esCorreoUanl('ana@gmail.com')).toBe(false);
    expect(esCorreoUanl('ana@uanl.edu.mx.evil.com')).toBe(false);
    expect(esCorreoUanl('ana@alumnos.uanl.edu.mx')).toBe(false);
    expect(esCorreoUanl('@uanl.edu.mx')).toBe(false);
    expect(esCorreoUanl('a@b@uanl.edu.mx')).toBe(false);
    expect(esCorreoUanl('ana lopez@uanl.edu.mx')).toBe(false);
  });
});

describe('validarCredenciales', () => {
  it('pide correo UANL y contraseña no vacía de 6 o más', () => {
    expect(validarCredenciales('ana@gmail.com', 'secreto1')).toMatch(/uanl\.edu\.mx/);
    expect(validarCredenciales('ana@uanl.edu.mx', '')).toMatch(/en blanco/);
    expect(validarCredenciales('ana@uanl.edu.mx', '      ')).toMatch(/en blanco/);
    expect(validarCredenciales('ana@uanl.edu.mx', '12345')).toMatch(/al menos 6/);
    expect(validarCredenciales('ana@uanl.edu.mx', 'secreto1')).toBeNull();
  });
});
