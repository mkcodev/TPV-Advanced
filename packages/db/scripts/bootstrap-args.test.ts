import { describe, expect, it } from 'vitest';
import { parseBootstrapArgs } from './bootstrap-args';

const FULL = [
  '--email',
  'Dueno@Bar.es',
  '--org',
  'Mi Bar SL',
  '--business',
  'Mi Bar',
  '--tax-id',
  'b12345678',
  '--legal-name',
  'Mi Bar SL',
  '--address',
  'Calle Mayor 1',
];

describe('parseBootstrapArgs', () => {
  it('parses, trims and normalises (email lowercase, tax id uppercase)', () => {
    expect(parseBootstrapArgs(FULL)).toEqual({
      email: 'dueno@bar.es',
      organization: 'Mi Bar SL',
      business: 'Mi Bar',
      taxId: 'B12345678',
      legalName: 'Mi Bar SL',
      address: 'Calle Mayor 1',
    });
  });

  it('ignores a leading "--" forwarded by pnpm', () => {
    expect(parseBootstrapArgs(['--', ...FULL]).email).toBe('dueno@bar.es');
  });

  it('lists every missing argument', () => {
    expect(() => parseBootstrapArgs(['--email', 'a@b.es'])).toThrow(
      /--org, --business, --tax-id, --legal-name, --address/,
    );
  });

  it('treats blank values as missing', () => {
    const args = [...FULL];
    args[args.indexOf('--address') + 1] = '   ';
    expect(() => parseBootstrapArgs(args)).toThrow(/--address/);
  });

  it('rejects an invalid email', () => {
    const args = [...FULL];
    args[1] = 'no-es-un-correo';
    expect(() => parseBootstrapArgs(args)).toThrow(/correo válido/);
  });

  it('rejects unknown options', () => {
    expect(() => parseBootstrapArgs([...FULL, '--business-id', 'x'])).toThrow();
  });
});
