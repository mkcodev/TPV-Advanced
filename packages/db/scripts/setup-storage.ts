// Crea el bucket product-images en Supabase Storage con políticas RLS.
// Uso: pnpm db:setup-storage
//
// Requisitos: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y DATABASE_URL en .env
//
// MEJORA PENDIENTE (Fase 2): la política de escritura valida que el usuario tenga
// acceso al negocio del prefijo vía has_business_access(), pero no comprueba que
// sea el negocio *activo* de la sesión. Esto es aceptable en Fase 1 (un solo negocio
// por org). Solución futura: JWT claim explícito o Edge Function validadora.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Variable de entorno requerida: ${name}`);
  return val;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const DATABASE_URL = requireEnv('DATABASE_URL');

async function main() {
  // 1. Crear bucket via Supabase client (idempotente: ignoramos error si ya existe)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: bucketError } = await supabase.storage.createBucket('product-images', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    fileSizeLimit: 2097152, // 2 MB
  });
  if (bucketError && !bucketError.message.includes('already exists')) {
    throw new Error(`Error al crear bucket: ${bucketError.message}`);
  }
  console.log('✓ Bucket product-images listo');

  // 2. Aplicar políticas RLS directamente via Postgres (prepare:false para Supabase pooler)
  const sql = postgres(DATABASE_URL, { prepare: false });

  try {
    // SELECT — lectura pública
    await sql.unsafe(`
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where schemaname='storage' and tablename='objects'
          and policyname='product_images_public_read'
        ) then
          create policy "product_images_public_read"
            on storage.objects for select
            using (bucket_id = 'product-images');
        end if;
      end $$;
    `);

    // INSERT — escritura restringida al prefijo del negocio autenticado
    await sql.unsafe(`
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where schemaname='storage' and tablename='objects'
          and policyname='product_images_write_own_business'
        ) then
          create policy "product_images_write_own_business"
            on storage.objects for insert
            with check (
              bucket_id = 'product-images'
              and auth.role() = 'authenticated'
              and public.has_business_access((storage.foldername(name))[1]::uuid)
            );
        end if;
      end $$;
    `);

    // UPDATE — reemplazar imagen existente del propio negocio
    await sql.unsafe(`
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where schemaname='storage' and tablename='objects'
          and policyname='product_images_update_own_business'
        ) then
          create policy "product_images_update_own_business"
            on storage.objects for update
            using (
              bucket_id = 'product-images'
              and auth.role() = 'authenticated'
              and public.has_business_access((storage.foldername(name))[1]::uuid)
            )
            with check (
              bucket_id = 'product-images'
              and auth.role() = 'authenticated'
              and public.has_business_access((storage.foldername(name))[1]::uuid)
            );
        end if;
      end $$;
    `);

    // DELETE — eliminar imagen del propio negocio
    await sql.unsafe(`
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where schemaname='storage' and tablename='objects'
          and policyname='product_images_delete_own_business'
        ) then
          create policy "product_images_delete_own_business"
            on storage.objects for delete
            using (
              bucket_id = 'product-images'
              and auth.role() = 'authenticated'
              and public.has_business_access((storage.foldername(name))[1]::uuid)
            );
        end if;
      end $$;
    `);

    console.log('✓ Políticas RLS aplicadas');

    // 3. Verificar que las 4 políticas existen
    const rows = await sql<{ policyname: string }[]>`
      select policyname
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname like 'product_images_%'
      order by policyname
    `;

    console.log(`✓ Políticas verificadas (${rows.length}/4):`);
    for (const row of rows) {
      console.log(`  • ${row.policyname}`);
    }

    if (rows.length < 4) {
      console.warn('⚠ Se esperaban 4 políticas; puede que algunas ya existieran con nombre diferente.');
    }
  } finally {
    await sql.end();
  }

  console.log('✓ Setup de Storage completado');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
