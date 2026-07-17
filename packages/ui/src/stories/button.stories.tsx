import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/button';

const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'success'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'xl', 'icon'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Guardar', variant: 'default', size: 'default' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'success'] as const).map(
        (v) => (
          <div key={v} className="flex flex-wrap items-center gap-3">
            {(['sm', 'default', 'lg', 'xl'] as const).map((s) => (
              <Button key={s} variant={v} size={s}>
                {v} {s}
              </Button>
            ))}
            <Button variant={v} disabled>
              disabled
            </Button>
          </div>
        ),
      )}
    </div>
  ),
  parameters: { layout: 'padded' },
};
