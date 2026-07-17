import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from '../components/separator';

const meta: Meta<typeof Separator> = {
  title: 'Design System/Separator',
  component: Separator,
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-64 space-y-3">
      <p className="text-sm text-foreground">Sección A</p>
      <Separator />
      <p className="text-sm text-foreground">Sección B</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex items-center gap-3 h-8">
      <span className="text-sm text-foreground">Elemento A</span>
      <Separator orientation="vertical" />
      <span className="text-sm text-foreground">Elemento B</span>
      <Separator orientation="vertical" />
      <span className="text-sm text-foreground">Elemento C</span>
    </div>
  ),
};
