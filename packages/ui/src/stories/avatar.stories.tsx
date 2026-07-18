import type { Meta, StoryObj } from '@storybook/react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Design System/Avatar',
  component: Avatar,
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
      <AvatarFallback>SC</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/no-image.png" alt="Usuario" />
      <AvatarFallback>MR</AvatarFallback>
    </Avatar>
  ),
};

export const EmployeeChips: Story = {
  render: () => (
    <div className="flex gap-3">
      {(['Ana', 'Luis', 'Eva', 'Pau'] as const).map((name) => (
        <div key={name} className="flex flex-col items-center gap-1">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-base">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'padded' },
};
