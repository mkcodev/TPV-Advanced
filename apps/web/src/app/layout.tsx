import { Toaster } from '@tpv/ui';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/* Inter es la fuente del design system (DESIGN-SYSTEM.md §2).
   La variable --font-inter la recoge globals.css en @theme inline { --font-sans }.
   display: swap evita FOIT; latin cubre español (tildes, ñ). */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TPV Advanced',
  description: 'Sistema de punto de venta para hostelería',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
