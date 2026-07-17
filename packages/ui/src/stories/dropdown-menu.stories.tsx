import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Design System/DropdownMenu',
  component: DropdownMenu,
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Opciones</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>Comanda</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Dividir cuenta</DropdownMenuItem>
        <DropdownMenuItem>Cambiar mesa</DropdownMenuItem>
        <DropdownMenuItem>Imprimir ticket</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">Anular comanda</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
