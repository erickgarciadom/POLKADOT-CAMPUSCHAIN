import { describe, expect, it } from 'vitest';
import { Status } from '../contract/campuschain';
import { estadoDesdeStatus, etiquetaEstado, meToca, opcionesPedido, resumenDe, statusDesdeEstado } from './estados';
import type { Orden } from './types';

const SELLER = '0x0000000000000000000000000000000000000001';
const BUYER = '0x0000000000000000000000000000000000000002';

const orden = (estado: Orden['estado']): Orden => ({
  orderId: `0x${'ab'.repeat(32)}`, productoId: '1', tituloProducto: 'x', cantidad: 1, totalCentavos: '100',
  comprador: BUYER, vendedor: SELLER, estado, resumen: resumenDe(estado), orderHash: '0x', txHash: null, timestamp: 1,
});

describe('estados', () => {
  it('ida y vuelta con el enum del contrato', () => {
    for (const s of [Status.CREATED, Status.ACCEPTED, Status.PAYMENT_REPORTED, Status.DELIVERED, Status.COMPLETED, Status.CANCELLED]) {
      expect(statusDesdeEstado(estadoDesdeStatus(s))).toBe(s);
    }
    expect(() => estadoDesdeStatus(Status.NONE)).toThrow();
    expect(etiquetaEstado('pago-reportado')).toBe('Pago reportado por vendedor');
  });

  it('las acciones siguen las reglas de orderActions', () => {
    expect(opcionesPedido(orden('creado'), SELLER).map((a) => a.accion)).toEqual(['aceptar']);
    expect(opcionesPedido(orden('creado'), BUYER).map((a) => a.accion)).toEqual(['cancelar']);
    expect(opcionesPedido(orden('entregado'), BUYER)).toMatchObject([{ accion: 'completar', siguiente: 'completado', peligro: false }]);
    expect(opcionesPedido(orden('completado'), BUYER)).toEqual([]);
    expect(meToca(orden('creado'), BUYER)).toBe(false);
    expect(meToca(orden('creado'), SELLER)).toBe(true);
  });
});
