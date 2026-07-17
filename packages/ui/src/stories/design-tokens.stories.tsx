import type { Meta, StoryObj } from '@storybook/react';

export default { title: 'Design System/Tokens' } satisfies Meta;

const COLOR_TOKENS = [
  { name: 'background', var: '--background' },
  { name: 'foreground', var: '--foreground' },
  { name: 'card', var: '--card' },
  { name: 'primary', var: '--primary' },
  { name: 'secondary', var: '--secondary' },
  { name: 'muted', var: '--muted' },
  { name: 'accent', var: '--accent' },
  { name: 'destructive', var: '--destructive' },
  { name: 'success', var: '--success' },
  { name: 'warning', var: '--warning' },
  { name: 'border', var: '--border' },
  { name: 'state-free', var: '--state-free' },
  { name: 'state-occupied', var: '--state-occupied' },
  { name: 'state-billing', var: '--state-billing' },
  { name: 'state-reserved', var: '--state-reserved' },
] as const;

const RADII = [
  { name: 'sm', class: 'rounded-sm', value: '4px' },
  { name: 'md', class: 'rounded-md', value: '6px' },
  { name: 'lg', class: 'rounded-lg', value: '8px' },
  { name: 'xl', class: 'rounded-xl', value: '12px' },
] as const;

const DURATIONS = [
  { name: 'fast', value: '150ms', use: 'feedback táctil' },
  { name: 'base', value: '250ms', use: 'transiciones UI' },
  { name: 'slow', value: '400ms', use: 'overlays / modales' },
] as const;

export const ColorPalette: StoryObj = {
  render: () => (
    <div className="p-6 space-y-2">
      <h2 className="text-xl font-semibold text-foreground mb-4">Color Palette</h2>
      <div className="grid grid-cols-5 gap-3">
        {COLOR_TOKENS.map(({ name, var: cssVar }) => (
          <div key={name} className="flex flex-col gap-1.5">
            <div
              className="h-16 w-full rounded-lg border border-border"
              style={{ background: `hsl(var(${cssVar}))` }}
            />
            <span className="text-xs font-medium text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground font-mono">{cssVar}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

export const Typography: StoryObj = {
  render: () => (
    <div className="p-6 space-y-4 max-w-xl">
      <h2 className="text-xl font-semibold text-foreground mb-4">Typography — Inter</h2>
      <div className="space-y-3 divide-y divide-border">
        <div className="pt-3">
          <p className="text-4xl font-bold text-foreground">Heading 1</p>
          <span className="text-xs text-muted-foreground">text-4xl font-bold</span>
        </div>
        <div className="pt-3">
          <p className="text-2xl font-semibold text-foreground">Heading 2</p>
          <span className="text-xs text-muted-foreground">text-2xl font-semibold</span>
        </div>
        <div className="pt-3">
          <p className="text-xl font-medium text-foreground">Heading 3</p>
          <span className="text-xs text-muted-foreground">text-xl font-medium</span>
        </div>
        <div className="pt-3">
          <p className="text-base text-foreground">
            Body — El texto base del sistema. Legible a cualquier tamaño de pantalla.
          </p>
          <span className="text-xs text-muted-foreground">text-base</span>
        </div>
        <div className="pt-3">
          <p className="text-sm text-muted-foreground">
            Small / muted — descripciones secundarias y metadatos.
          </p>
          <span className="text-xs text-muted-foreground">text-sm text-muted-foreground</span>
        </div>
        <div className="pt-3">
          <p className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
            Label / Tag
          </p>
          <span className="text-xs text-muted-foreground">
            text-xs uppercase tracking-widest font-medium
          </span>
        </div>
        <div className="pt-3">
          <p className="text-base tabular-nums text-foreground">1.234,56 € — tabular-nums</p>
          <span className="text-xs text-muted-foreground">tabular-nums (precios)</span>
        </div>
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

export const BorderRadius: StoryObj = {
  render: () => (
    <div className="p-6 space-y-2">
      <h2 className="text-xl font-semibold text-foreground mb-4">Border Radius</h2>
      <div className="flex items-end gap-6">
        {RADII.map(({ name, class: cls, value }) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <div className={`h-16 w-16 bg-primary ${cls}`} />
            <span className="text-xs font-medium text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

export const MotionDurations: StoryObj = {
  render: () => (
    <div className="p-6 space-y-2">
      <h2 className="text-xl font-semibold text-foreground mb-4">Motion — Durations</h2>
      <div className="flex gap-3">
        {DURATIONS.map(({ name, value, use }) => (
          <div
            key={name}
            className="flex flex-col gap-1 rounded-lg border border-border bg-muted px-4 py-3"
          >
            <span className="text-sm font-semibold text-foreground">--duration-{name}</span>
            <span className="text-xl font-mono text-primary">{value}</span>
            <span className="text-xs text-muted-foreground">{use}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
