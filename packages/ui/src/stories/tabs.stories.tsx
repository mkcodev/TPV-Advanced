import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Design System/Tabs',
  component: Tabs,
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="bebidas" className="w-80">
      <TabsList className="w-full">
        <TabsTrigger value="bebidas" className="flex-1">
          Bebidas
        </TabsTrigger>
        <TabsTrigger value="cocina" className="flex-1">
          Cocina
        </TabsTrigger>
        <TabsTrigger value="postres" className="flex-1">
          Postres
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bebidas" className="p-3 text-sm text-foreground">
        Contenido de bebidas — refrescos, cervezas, vinos...
      </TabsContent>
      <TabsContent value="cocina" className="p-3 text-sm text-foreground">
        Contenido de cocina — entrantes, principales...
      </TabsContent>
      <TabsContent value="postres" className="p-3 text-sm text-foreground">
        Contenido de postres — tartas, helados...
      </TabsContent>
    </Tabs>
  ),
};
