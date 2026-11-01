/** Secciones del menú: pestañas arriba en el celular, columna a la derecha en pantallas anchas. */
export type Seccion = 'catalogo' | 'pedidos' | 'vender' | 'ventas' | 'cuenta';

export interface ItemMenu {
  id: Seccion;
  href: string;
  etiqueta: string;
  /** Trazo del icono (SVG 24 × 24, línea de 2 px). Va en el bundle: nada de recursos externos. */
  trazo: string;
}

export const SECCIONES: readonly ItemMenu[] = [
  { id: 'catalogo', href: '#/', etiqueta: 'Catálogo', trazo: 'M4 10h16M5 10l1.5-5h11L19 10M5 10v9h14v-9M10 19v-5h4v5' },
  { id: 'pedidos', href: '#/pedidos', etiqueta: 'Mis pedidos', trazo: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9' },
  { id: 'vender', href: '#/vender', etiqueta: 'Vender', trazo: 'M3 12V4h8l9.5 9.5-8 8zM7.5 8h.01' },
  { id: 'ventas', href: '#/ventas', etiqueta: 'Ventas', trazo: 'M4 20h16M7 16v-4M12 16V8M17 16V9' },
  { id: 'cuenta', href: '#/cuenta', etiqueta: 'Cuenta', trazo: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0' },
];

const SVG = 'http://www.w3.org/2000/svg';

export function icono(trazo: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) {
    svg.setAttribute(k, v);
  }
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', trazo);
  svg.appendChild(path);
  return svg;
}
