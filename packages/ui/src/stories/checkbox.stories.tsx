import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Checkbox } from '../components/checkbox';
import { Label } from '../components/label';

const meta: Meta<typeof Checkbox> = {
  title: 'Design System/Checkbox',
  component: Checkbox,
  argTypes: {
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id="cb-default"
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        <Label htmlFor="cb-default">Acepto los términos y condiciones</Label>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="cb-disabled" disabled defaultChecked />
      <Label htmlFor="cb-disabled" className="opacity-50">
        Opción bloqueada
      </Label>
    </div>
  ),
};

export const Permisos: Story = {
  render: () => {
    const opciones = ['Ver comandas', 'Crear productos', 'Ver informes', 'Cerrar caja', 'Admin'];
    const [sel, setSel] = useState(new Set(['Ver comandas']));

    const toggle = (op: string) =>
      setSel((s) => {
        const next = new Set(s);
        if (next.has(op)) next.delete(op);
        else next.add(op);
        return next;
      });

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Permisos del rol</p>
        {opciones.map((op) => (
          <div key={op} className="flex items-center gap-2">
            <Checkbox id={`cb-${op}`} checked={sel.has(op)} onCheckedChange={() => toggle(op)} />
            <Label htmlFor={`cb-${op}`}>{op}</Label>
          </div>
        ))}
      </div>
    );
  },
  parameters: { layout: 'padded' },
};
