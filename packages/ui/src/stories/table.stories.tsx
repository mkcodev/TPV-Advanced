import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../components/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/table';

const meta: Meta<typeof Table> = {
  title: 'Design System/Table',
  component: Table,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof Table>;

const PRODUCTOS = [
  { nombre: 'Café con leche', categoria: 'Bebidas', precio: '1,50 €', iva: '10%', activo: true },
  { nombre: 'Tortilla española', categoria: 'Cocina', precio: '4,00 €', iva: '10%', activo: true },
  {
    nombre: 'Agua mineral 0,5L',
    categoria: 'Bebidas',
    precio: '1,20 €',
    iva: '10%',
    activo: false,
  },
  { nombre: 'Tarta de queso', categoria: 'Postres', precio: '3,50 €', iva: '10%', activo: true },
  { nombre: 'Cerveza media', categoria: 'Bebidas', precio: '2,00 €', iva: '21%', activo: true },
];

export const ProductosCRUD: Story = {
  render: () => (
    <Table>
      <TableCaption>Listado de productos del menú</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>IVA</TableHead>
          <TableHead className="text-right tabular-nums">Precio</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {PRODUCTOS.map((p) => (
          <TableRow key={p.nombre}>
            <TableCell className="font-medium">{p.nombre}</TableCell>
            <TableCell>{p.categoria}</TableCell>
            <TableCell>{p.iva}</TableCell>
            <TableCell className="text-right tabular-nums">{p.precio}</TableCell>
            <TableCell>
              <Badge variant={p.activo ? 'default' : 'secondary'}>
                {p.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total productos activos</TableCell>
          <TableCell className="text-right tabular-nums">
            {PRODUCTOS.filter((p) => p.activo).length} / {PRODUCTOS.length}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
