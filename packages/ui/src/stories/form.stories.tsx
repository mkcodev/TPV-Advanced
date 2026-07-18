import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';
import { Button } from '../components/button';
import { Checkbox } from '../components/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../components/form';
import { Input } from '../components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/select';

const meta: Meta = {
  title: 'Design System/Form',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

type ProductoForm = {
  nombre: string;
  precio: string;
  categoria: string;
  activo: boolean;
};

export const NuevoProducto: Story = {
  render: () => {
    const form = useForm<ProductoForm>({
      defaultValues: { nombre: '', precio: '', categoria: '', activo: true },
    });

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => alert(JSON.stringify(data, null, 2)))}
          className="space-y-6 w-80"
        >
          <FormField
            control={form.control}
            name="nombre"
            rules={{ required: 'El nombre es obligatorio' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del producto</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Café con leche" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="precio"
            rules={{
              required: 'El precio es obligatorio',
              pattern: { value: /^\d+([.,]\d{1,2})?$/, message: 'Precio inválido' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio (€)</FormLabel>
                <FormControl>
                  <Input placeholder="0,00" type="text" inputMode="decimal" {...field} />
                </FormControl>
                <FormDescription>Sin símbolo €. Usa coma o punto decimal.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoria"
            rules={{ required: 'Selecciona una categoría' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="bebidas">Bebidas</SelectItem>
                    <SelectItem value="cocina">Cocina</SelectItem>
                    <SelectItem value="postres">Postres</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="activo"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Producto activo</FormLabel>
                  <FormDescription>Aparece en el menú del TPV.</FormDescription>
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Guardar producto
          </Button>
        </form>
      </Form>
    );
  },
};

type LoginForm = {
  usuario: string;
  password: string;
};

export const LoginAdmin: Story = {
  render: () => {
    const form = useForm<LoginForm>({
      defaultValues: { usuario: '', password: '' },
    });

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(() => {})} className="space-y-4 w-72">
          <FormField
            control={form.control}
            name="usuario"
            rules={{ required: 'Campo obligatorio' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usuario</FormLabel>
                <FormControl>
                  <Input placeholder="admin@restaurante.es" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            rules={{
              required: 'Campo obligatorio',
              minLength: { value: 8, message: 'Mínimo 8 caracteres' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </Form>
    );
  },
};
