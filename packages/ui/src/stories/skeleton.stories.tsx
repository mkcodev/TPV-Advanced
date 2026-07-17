import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from '../components/skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Design System/Skeleton',
  component: Skeleton,
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Lines: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  ),
};

export const CardSkeleton: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-72 rounded-lg border border-border p-4">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  ),
};

export const ProductGrid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3 w-72">
      {Array.from({ length: 6 }, (_, i) => `sk-${i}`).map((id) => (
        <Skeleton key={id} className="aspect-square rounded-lg" />
      ))}
    </div>
  ),
};
