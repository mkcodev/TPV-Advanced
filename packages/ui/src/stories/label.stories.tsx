import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../components/input';
import { Label } from '../components/label';

const meta: Meta<typeof Label> = {
  title: 'Design System/Label',
  component: Label,
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: 'Nombre del producto' },
};

export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5 w-64">
      <Label htmlFor="demo-input">Precio (€)</Label>
      <Input id="demo-input" type="number" placeholder="0,00" className="tabular-nums" />
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5 w-64">
      <Label htmlFor="req-input">
        Mesa <span className="text-destructive">*</span>
      </Label>
      <Input id="req-input" placeholder="Número de mesa" required />
    </div>
  ),
};
