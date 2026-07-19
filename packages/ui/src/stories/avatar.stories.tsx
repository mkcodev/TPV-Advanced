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

// Verifica que una imagen rectangular NO se deforma (regresión del bug sin object-cover).
export const RectangularSource: Story = {
  render: () => (
    <div className="flex gap-4 items-end">
      <div className="flex flex-col items-center gap-1">
        <Avatar className="h-16 w-16 rounded-md">
          <AvatarImage
            src="https://picsum.photos/seed/wide/400/200"
            alt="Imagen apaisada 2:1"
          />
          <AvatarFallback className="rounded-md">AP</AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">400×200 (2:1)</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Avatar className="h-16 w-16 rounded-md">
          <AvatarImage
            src="https://picsum.photos/seed/tall/200/400"
            alt="Imagen vertical 1:2"
          />
          <AvatarFallback className="rounded-md">VT</AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">200×400 (1:2)</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Avatar className="h-16 w-16 rounded-md">
          <AvatarImage
            src="https://picsum.photos/seed/square/300/300"
            alt="Imagen cuadrada 1:1"
          />
          <AvatarFallback className="rounded-md">SQ</AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">300×300 (1:1)</span>
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
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
