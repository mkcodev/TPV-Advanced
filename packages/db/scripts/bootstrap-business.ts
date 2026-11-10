// Alta de un negocio REAL, sin datos demo.
// Crea: users (perfil), organizations, businesses y memberships(owner).
// NO borra nada y NO crea productos, mesas ni empleados (eso se hace desde el admin).
//
// Antes: crea el usuario del dueño en Supabase (Dashboard → Authentication → Users).
// Uso:   pnpm db:bootstrap -- --email dueno@bar.es --org "Mi Bar SL" --business "Mi Bar" \
//          --tax-id B12345678 --legal-name "Mi Bar SL" --address "Calle Mayor 1, 28001 Madrid"
// Salida: por stdout solo el businessId; los mensajes van por stderr.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { and, eq, sql } from 'drizzle-orm';
import { createDb } from '../src/client';
import { businesses, memberships, organizations, users } from '../src/schema/index';
import { parseBootstrapArgs } from './bootstrap-args';

async function main() {
  const args = parseBootstrapArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Variable de entorno requerida: DATABASE_URL');
  const db = createDb(databaseUrl);

  // El usuario ya debe existir en Supabase Auth: lo buscamos por correo en auth.users.
  const found = (await db.execute(
    sql`select id from auth.users where lower(email) = ${args.email} limit 1`,
  )) as unknown as { id: string }[];
  const userId = found[0]?.id;
  if (!userId) {
    throw new Error(
      `No existe ningún usuario con el correo ${args.email} en Supabase Auth. Créalo primero (Dashboard → Authentication → Users).`,
    );
  }

  // No duplicar: si este usuario ya es dueño de un negocio con el mismo NIF, se aborta.
  const duplicate = await db
    .select({ id: businesses.id })
    .from(businesses)
    .innerJoin(organizations, eq(businesses.organizationId, organizations.id))
    .where(and(eq(organizations.ownerUserId, userId), eq(businesses.taxId, args.taxId)))
    .limit(1);
  if (duplicate.length > 0) {
    throw new Error(
      `Ese usuario ya es dueño de un negocio con NIF ${args.taxId} (id ${duplicate[0]?.id}). No se ha creado nada.`,
    );
  }

  // Transacción: o se crea todo o no se crea nada.
  const businessId = await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: userId, email: args.email }).onConflictDoNothing();

    const [org] = await tx
      .insert(organizations)
      .values({ name: args.organization, ownerUserId: userId })
      .returning({ id: organizations.id });
    if (!org) throw new Error('No se pudo crear la organización');

    const [business] = await tx
      .insert(businesses)
      .values({
        organizationId: org.id,
        name: args.business,
        legalName: args.legalName,
        taxId: args.taxId,
        address: args.address,
        invoiceSeries: `A${new Date().getFullYear()}`,
      })
      .returning({ id: businesses.id });
    if (!business) throw new Error('No se pudo crear el negocio');

    await tx.insert(memberships).values({ userId, organizationId: org.id, role: 'owner' });
    return business.id;
  });

  console.error(`Negocio "${args.business}" creado. Entra en /admin con ${args.email}.`);
  console.log(businessId);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
