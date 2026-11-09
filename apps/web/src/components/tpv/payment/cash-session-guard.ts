// Decide si el diálogo de cobro debe ofrecer "Abrir caja".
// Solo el efectivo exige caja abierta (tarjeta y Bizum no); el servidor lo valida igualmente.

// `session`: undefined = aún cargando, null = no hay caja abierta, objeto = caja abierta.
export function shouldPromptOpenCash(
  methods: readonly string[],
  session: object | null | undefined,
): boolean {
  // Mientras carga no se avisa, para no parpadear un aviso falso.
  if (session === undefined) return false;
  return session === null && methods.includes('cash');
}
