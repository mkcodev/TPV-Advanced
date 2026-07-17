import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/card';

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Mesa 5</CardTitle>
        <CardDescription>Zona terraza · 4 comensales</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Comanda abierta hace 45 min.</p>
        <p className="text-lg font-semibold tabular-nums mt-2">47,50 €</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" variant="outline">
          Ver comanda
        </Button>
        <Button size="sm" variant="success">
          Cobrar
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Minimal: Story = {
  render: () => (
    <Card className="w-72 p-4">
      <p className="text-sm text-foreground">Tarjeta mínima sin estructura.</p>
    </Card>
  ),
};
