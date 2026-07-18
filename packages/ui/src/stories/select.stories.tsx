import type { Meta, StoryObj } from '@storybook/react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../components/select';

const meta: Meta<typeof Select> = {
  title: 'Design System/Select',
  component: Select,
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Selecciona categoría" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="bebidas">Bebidas</SelectItem>
        <SelectItem value="cocina">Cocina</SelectItem>
        <SelectItem value="postres">Postres</SelectItem>
        <SelectItem value="otros">Otros</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-60">
        <SelectValue placeholder="Selecciona IVA" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Tipo reducido</SelectLabel>
          <SelectItem value="4">4% — superreducido</SelectItem>
          <SelectItem value="10">10% — reducido</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Tipo general</SelectLabel>
          <SelectItem value="21">21% — general</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-52">
        <SelectValue placeholder="No disponible" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Opción A</SelectItem>
      </SelectContent>
    </Select>
  ),
};
