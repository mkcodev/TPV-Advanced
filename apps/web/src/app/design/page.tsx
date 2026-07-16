import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@tpv/ui';

/* Página de verificación visual del design system.
   TEMPORAL — eliminar o proteger con autenticación antes de producción. */
export default function DesignPage() {
  return (
    <main className="min-h-screen bg-background p-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Design System — TPV Advanced</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Página de verificación visual. Fuente: Inter. Tokens: tokens.css.
        </p>
      </div>

      {/* ── Buttons ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Buttons</h2>
        {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'success'] as const).map(
          (variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              {(['sm', 'default', 'lg', 'xl', 'icon'] as const).map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size === 'icon' ? '★' : `${variant} ${size}`}
                </Button>
              ))}
            </div>
          ),
        )}
        <Button disabled>Deshabilitado</Button>
      </section>

      <Separator />

      {/* ── Swatches de color ────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Tokens de color</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[
            {
              name: 'background',
              bg: 'bg-background',
              text: 'text-foreground',
              border: 'border border-border',
            },
            { name: 'foreground', bg: 'bg-foreground', text: 'text-background', border: '' },
            { name: 'primary', bg: 'bg-primary', text: 'text-primary-foreground', border: '' },
            {
              name: 'secondary',
              bg: 'bg-secondary',
              text: 'text-secondary-foreground',
              border: '',
            },
            { name: 'muted', bg: 'bg-muted', text: 'text-muted-foreground', border: '' },
            { name: 'accent', bg: 'bg-accent', text: 'text-accent-foreground', border: '' },
            {
              name: 'destructive',
              bg: 'bg-destructive',
              text: 'text-destructive-foreground',
              border: '',
            },
            { name: 'success', bg: 'bg-success', text: 'text-success-foreground', border: '' },
            { name: 'warning', bg: 'bg-warning', text: 'text-warning-foreground', border: '' },
            { name: 'border / input', bg: 'bg-border', text: 'text-foreground', border: '' },
            { name: 'ring', bg: 'bg-ring', text: 'text-primary-foreground', border: '' },
            { name: 'state-free', bg: 'bg-state-free', text: 'text-foreground', border: '' },
            {
              name: 'state-occupied',
              bg: 'bg-state-occupied',
              text: 'text-primary-foreground',
              border: '',
            },
            {
              name: 'state-billing',
              bg: 'bg-state-billing',
              text: 'text-warning-foreground',
              border: '',
            },
            {
              name: 'state-reserved',
              bg: 'bg-state-reserved',
              text: 'text-primary-foreground',
              border: '',
            },
          ].map(({ name, bg, text, border }) => (
            <div
              key={name}
              className={`rounded-lg p-3 ${bg} ${text} ${border} min-h-[72px] flex flex-col justify-between`}
            >
              <span className="text-[10px] font-mono opacity-70">{name}</span>
              <span className="text-sm font-medium">Aa 123</span>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Badges ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="state-free">Libre</Badge>
          <Badge variant="state-occupied">Ocupada</Badge>
          <Badge variant="state-billing">Por cobrar</Badge>
          <Badge variant="state-reserved">Reservada</Badge>
        </div>
      </section>

      <Separator />

      {/* ── Input + Label ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Input + Label</h2>
        <div className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-input">Nombre del producto</Label>
            <Input id="demo-input" placeholder="Ej: Café con leche" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-price">Precio (€)</Label>
            {/* tabular-nums: los dígitos no cambian de ancho al editar */}
            <Input
              id="demo-price"
              type="number"
              placeholder="0.00"
              className="tabular-nums font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-disabled">Deshabilitado</Label>
            <Input id="demo-disabled" disabled defaultValue="Sin editar" />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Card ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Card</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Tarjeta estándar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Superficie con borde y sombra mínima. p-4 estándar.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Con números tabulares</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">42,50 €</p>
              <p className="text-sm text-muted-foreground">Precio siempre tabular-nums</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Tabs</h2>
        <Tabs defaultValue="tab1" className="max-w-md">
          <TabsList>
            <TabsTrigger value="tab1">Bebidas</TabsTrigger>
            <TabsTrigger value="tab2">Cocina</TabsTrigger>
            <TabsTrigger value="tab3">Postres</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <Card>
              <CardContent className="pt-4">Contenido de Bebidas</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tab2">
            <Card>
              <CardContent className="pt-4">Contenido de Cocina</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tab3">
            <Card>
              <CardContent className="pt-4">Contenido de Postres</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <Separator />

      {/* ── Skeleton ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Skeleton (carga)</h2>
        <div className="space-y-3 max-w-sm">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-28" />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Tipografía ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Tipografía (Inter)</h2>
        <div className="space-y-2">
          <p className="text-4xl font-bold">Display: 42,50 €</p>
          <p className="text-3xl font-bold">H1: TPV Advanced</p>
          <p className="text-2xl font-semibold">H2: Sección</p>
          <p className="text-xl font-semibold">H3: Subsección</p>
          <p className="text-lg font-semibold">H4: Encabezado menor</p>
          <p className="text-base">Body-lg: Texto táctil</p>
          <p className="text-sm">Body (base): texto normal</p>
          <p className="text-xs font-medium">Caption: etiquetas</p>
          <p className="text-2xl font-semibold tabular-nums">
            Tabular nums: 1.234,56 € vs 9.999,99 €
          </p>
        </div>
      </section>
    </main>
  );
}
