import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        outline: 'text-foreground',
        /* Estados de mesa: solo para fichas de plano, no para texto.
           Ver nota de contraste en tokens.css. */
        'state-free': 'border-transparent bg-state-free text-foreground',
        'state-occupied': 'border-transparent bg-state-occupied text-primary-foreground',
        'state-billing': 'border-transparent bg-state-billing text-warning-foreground',
        'state-reserved': 'border-transparent bg-state-reserved text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
