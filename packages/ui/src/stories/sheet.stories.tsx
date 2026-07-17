import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from '../components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../components/sheet';

const meta: Meta<typeof Sheet> = {
  title: 'Design System/Sheet',
  component: Sheet,
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">Abrir panel</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalle de comanda</SheetTitle>
            <SheetDescription>Mesa 5 · Zona terraza</SheetDescription>
          </SheetHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Contenido del panel lateral — artículos, historial, etc.
          </div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  },
};

export const FromLeft: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">Panel izquierdo</Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menú lateral</SheetTitle>
          </SheetHeader>
          <div className="py-4 text-sm text-muted-foreground">Navegación o filtros.</div>
        </SheetContent>
      </Sheet>
    );
  },
};
