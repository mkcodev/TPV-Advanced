import type { Meta, StoryObj } from '@storybook/react';
import { ScrollArea } from '../components/scroll-area';
import { Separator } from '../components/separator';

const meta: Meta<typeof ScrollArea> = {
  title: 'Design System/ScrollArea',
  component: ScrollArea,
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

const CATEGORIAS = [
  'Bebidas calientes',
  'Bebidas frías',
  'Cervezas',
  'Vinos',
  'Destilados',
  'Tapas',
  'Bocadillos',
  'Platos del día',
  'Postres',
  'Helados',
  'Infusiones',
  'Otros',
];

export const ListaLateral: Story = {
  render: () => (
    <ScrollArea className="h-64 w-48 rounded-md border">
      <div className="p-4">
        <h4 className="mb-2 text-sm font-medium leading-none">Categorías</h4>
        {CATEGORIAS.map((cat) => (
          <div key={cat}>
            <p className="py-2 text-sm">{cat}</p>
            <Separator className="my-0" />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const GridProductos: Story = {
  render: () => (
    <ScrollArea className="h-72 w-96 rounded-md border p-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 30 }, (_, i) => `Producto ${i + 1}`).map((p) => (
          <div
            key={p}
            className="rounded-md bg-muted p-3 text-xs text-center text-muted-foreground"
          >
            {p}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
