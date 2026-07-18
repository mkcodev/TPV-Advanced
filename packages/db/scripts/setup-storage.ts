// Crea el bucket product-images en Supabase Storage con políticas RLS.
// Uso: pnpm db:setup-storage
//
// Requisitos: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
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

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Variable de entorno requerida: ${name}`);
  return val;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Crear bucket (idempotente: ignoramos el error si ya existe)
  const { error: bucketError } = await supabase.storage.createBucket('product-images', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    fileSizeLimit: 2097152, // 2 MB
  });
  if (bucketError && !bucketError.message.includes('already exists')) {
    throw new Error(`Error al crear bucket: ${bucketError.message}`);
  }
  console.log('✓ Bucket product-images listo');

  // 2. Aplicar políticas RLS via SQL (service role puede ejecutar SQL directo)
  const policies = [
    // Lectura pública
    `
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
    `,
    // INSERT restringido al prefijo del negocio del usuario autenticado
    `
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
    `,
    // UPDATE: reemplazar imagen existente (mismo prefijo de negocio)
    `
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
    `,
    // DELETE: eliminar imagen del propio negocio
    `
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
    `,
  ];

  for (const sql of policies) {
    const { error } = await supabase.rpc('exec_sql', { sql }).single();
    if (error) {
      // exec_sql puede no existir; avisar y continuar
      console.warn(
        `⚠ No se pudo aplicar política vía RPC. Aplícala manualmente en Supabase SQL Editor:\n${sql.trim()}`,
      );
    }
  }

  console.log('✓ Setup de Storage completado');
  console.log('  Si las políticas no se aplicaron automáticamente, ejecuta el SQL');
  console.log('  mostrado arriba en el SQL Editor de Supabase Dashboard.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
