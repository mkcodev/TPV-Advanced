import type { Meta, StoryObj } from '@storybook/react';
import { Badge, type BadgeProps } from '../components/badge';

const meta: Meta<typeof Badge> = {
  title: 'Design System/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'success',
        'warning',
        'outline',
        'state-free',
        'state-occupied',
        'state-billing',
        'state-reserved',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Nuevo', variant: 'default' },
};

export const AllVariants: Story = {
  render: () => {
    const variants: BadgeProps['variant'][] = [
      'default',
      'secondary',
      'destructive',
      'success',
      'warning',
      'outline',
      'state-free',
      'state-occupied',
      'state-billing',
      'state-reserved',
    ];
    return (
      <div className="flex flex-wrap gap-2 p-4">
        {variants.map((v) => (
          <Badge key={v} variant={v}>
            {v}
          </Badge>
        ))}
      </div>
    );
  },
  parameters: { layout: 'padded' },
};
