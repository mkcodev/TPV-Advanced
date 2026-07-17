import type { Meta, StoryObj } from '@storybook/react';
import { toast } from 'sonner';
import { Button } from '../components/button';
import { Toaster } from '../components/sonner';

const meta: Meta<typeof Toaster> = {
  title: 'Design System/Sonner',
  component: Toaster,
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex flex-col gap-2">
        <Button onClick={() => toast('Línea añadida')}>Toast info</Button>
        <Button variant="success" onClick={() => toast.success('Comanda guardada')}>
          Toast success
        </Button>
        <Button variant="destructive" onClick={() => toast.error('Error al guardar')}>
          Toast error
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast('Línea eliminada', {
              action: { label: 'Deshacer', onClick: () => {} },
            })
          }
        >
          Toast con acción
        </Button>
      </div>
    </>
  ),
};
