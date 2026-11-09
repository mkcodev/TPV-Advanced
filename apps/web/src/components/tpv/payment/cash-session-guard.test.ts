import { describe, expect, it } from 'vitest';
import { shouldPromptOpenCash } from './cash-session-guard';

describe('shouldPromptOpenCash', () => {
  it('avisa si se cobra en efectivo y no hay caja abierta', () => {
    expect(shouldPromptOpenCash(['cash'], null)).toBe(true);
  });

  it('avisa si el efectivo es solo una parte de un pago mixto', () => {
    expect(shouldPromptOpenCash(['card', 'cash'], null)).toBe(true);
  });

  it('no avisa con tarjeta o Bizum, que no necesitan caja', () => {
    expect(shouldPromptOpenCash(['card'], null)).toBe(false);
    expect(shouldPromptOpenCash(['bizum', 'card'], null)).toBe(false);
  });

  it('no avisa si la caja ya está abierta', () => {
    expect(shouldPromptOpenCash(['cash'], { id: 'session-1' })).toBe(false);
  });

  it('no avisa mientras se está cargando el estado de la caja', () => {
    expect(shouldPromptOpenCash(['cash'], undefined)).toBe(false);
  });
});
