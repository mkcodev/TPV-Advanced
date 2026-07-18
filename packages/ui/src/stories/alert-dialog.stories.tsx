import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/alert-dialog';
import { Button } from '../components/button';

const meta: Meta<typeof AlertDialog> = {
  title: 'Design System/AlertDialog',
  component: AlertDialog,
};

export default meta;
type Story = StoryObj<typeof AlertDialog>;

export const AnularComanda: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Anular comanda</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular comanda completa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los productos de la comanda y el
              importe no se cobrará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setOpen(false)}
            >
              Sí, anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
};

export const CerrarCaja: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Cerrar caja</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión de caja?</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará el arqueo de caja y se cerrará la sesión de todos los empleados. Las
              comandas abiertas quedarán guardadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setOpen(false)}>Cerrar caja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
};
