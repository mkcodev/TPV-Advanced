import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../components/input';

const meta: Meta<typeof Input> = {
  title: 'Design System/Input',
  component: Input,
  argTypes: {
    disabled: { control: 'boolean' },
    type: { control: 'select', options: ['text', 'email', 'password', 'number'] },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Escribe algo...' },
};

export const WithValue: Story = {
  args: { defaultValue: 'Valor de ejemplo' },
};

export const Disabled: Story = {
  args: { defaultValue: 'No editable', disabled: true },
};

export const NumericTabular: Story = {
  render: () => (
    <Input
      type="number"
      defaultValue="1234.56"
      className="tabular-nums w-40 text-right"
      aria-label="Precio en euros"
    />
  ),
};
