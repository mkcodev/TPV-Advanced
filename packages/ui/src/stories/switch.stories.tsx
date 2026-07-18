import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Label } from '../components/label';
import { Switch } from '../components/switch';

const meta: Meta<typeof Switch> = {
  title: 'Design System/Switch',
  component: Switch,
  argTypes: {
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center gap-3">
        <Switch id="sw-default" checked={checked} onCheckedChange={setChecked} />
        <Label htmlFor="sw-default">{checked ? 'Activo' : 'Inactivo'}</Label>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="sw-disabled" disabled defaultChecked />
      <Label htmlFor="sw-disabled" className="opacity-50">
        Modo mantenimiento
      </Label>
    </div>
  ),
};

export const AjustesTPV: Story = {
  render: () => {
    const [estado, setEstado] = useState({
      impresionAuto: true,
      sonido: false,
      darkMode: false,
    });
    return (
      <div className="space-y-4 w-72">
        {(
          [
            { key: 'impresionAuto', label: 'Impresión automática', desc: 'Imprime al cobrar' },
            { key: 'sonido', label: 'Sonido', desc: 'Pitido al añadir producto' },
            { key: 'darkMode', label: 'Modo oscuro (KDS)', desc: 'Para pantalla de cocina' },
          ] as const
        ).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch
              checked={estado[key]}
              onCheckedChange={(v) => setEstado((s) => ({ ...s, [key]: v }))}
              aria-label={label}
            />
          </div>
        ))}
      </div>
    );
  },
  parameters: { layout: 'padded' },
};
