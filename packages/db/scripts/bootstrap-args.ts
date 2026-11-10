// Argumentos del script db:bootstrap. Lógica pura (sin BD ni entorno) para poder testearla.
import { parseArgs } from 'node:util';

export interface BootstrapArgs {
  email: string;
  organization: string;
  business: string;
  taxId: string;
  legalName: string;
  address: string;
}

const USAGE = `Uso: pnpm db:bootstrap -- --email dueno@bar.es --org "Mi Bar SL" --business "Mi Bar" \\
  --tax-id B12345678 --legal-name "Mi Bar SL" --address "Calle Mayor 1, 28001 Madrid"`;

// Todos los datos son obligatorios: el ticket legal necesita razón social, NIF y dirección.
export function parseBootstrapArgs(argv: string[]): BootstrapArgs {
  // pnpm puede reenviar el "--" de "pnpm db:bootstrap -- --email ..."; parseArgs lo
  // tomaría como "fin de opciones", así que se descarta.
  const { values } = parseArgs({
    args: argv[0] === '--' ? argv.slice(1) : argv,
    options: {
      email: { type: 'string' },
      org: { type: 'string' },
      business: { type: 'string' },
      'tax-id': { type: 'string' },
      'legal-name': { type: 'string' },
      address: { type: 'string' },
    },
    strict: true,
  });

  const clean = (v: string | undefined) => v?.trim() ?? '';
  const args = {
    email: clean(values.email).toLowerCase(),
    organization: clean(values.org),
    business: clean(values.business),
    taxId: clean(values['tax-id']).toUpperCase(),
    legalName: clean(values['legal-name']),
    address: clean(values.address),
  };

  const labels: Record<keyof BootstrapArgs, string> = {
    email: '--email',
    organization: '--org',
    business: '--business',
    taxId: '--tax-id',
    legalName: '--legal-name',
    address: '--address',
  };
  const missing = (Object.keys(labels) as (keyof BootstrapArgs)[])
    .filter((k) => args[k] === '')
    .map((k) => labels[k]);
  if (missing.length > 0) {
    throw new Error(`Faltan argumentos: ${missing.join(', ')}\n${USAGE}`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
    throw new Error(`--email no parece un correo válido: ${args.email}`);
  }

  return args;
}
