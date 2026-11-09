import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@tpv/ui';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

// Le dice a React que estamos dentro de un test, para que act() funcione sin avisos.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

function Demo({ label, open }: { label: string; open: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{label}</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

// Dos diálogos hermanos, como el cobro y "Abrir caja": el primero se monta antes.
function render(outerOpen: boolean, innerOpen: boolean) {
  const ui = (
    <>
      <Demo label="outer" open={outerOpen} />
      <Demo label="inner" open={innerOpen} />
    </>
  );
  if (!root) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => root?.render(ui));
}

// Overlays en orden de montaje (los de Radix son los únicos con "fixed inset-0").
function overlayClasses(): string[] {
  return [...document.querySelectorAll('.fixed.inset-0')].map((el) => el.className);
}

describe('overlay de diálogos', () => {
  it('un diálogo oscurece y desenfoca con los tokens, sin negro fijo', () => {
    render(true, false);

    const [overlay, ...rest] = overlayClasses();
    expect(rest).toHaveLength(0);
    expect(overlay).toContain('bg-overlay');
    expect(overlay).toContain('backdrop-blur-(--overlay-blur)');
    expect(overlay).toContain('z-(--z-overlay)');
    expect(overlay).not.toContain('bg-black');
  });

  it('un diálogo anidado no suma oscurecimiento', () => {
    render(true, true);

    const [first, second, ...rest] = overlayClasses();
    expect(rest).toHaveLength(0);
    expect(first).toContain('bg-overlay');
    expect(second).toContain('bg-transparent');
    expect(second).not.toContain('bg-overlay');
    expect(second).not.toContain('backdrop-blur');
  });

  it('al cerrar el interior, el exterior sigue oscurecido', () => {
    render(true, true);
    render(true, false);

    const [only, ...rest] = overlayClasses();
    expect(rest).toHaveLength(0);
    expect(only).toContain('bg-overlay');
  });

  it('al cerrar el exterior primero, el interior pasa a oscurecer', () => {
    render(true, true);
    render(false, true);

    const [only, ...rest] = overlayClasses();
    expect(rest).toHaveLength(0);
    expect(only).toContain('bg-overlay');
    expect(only).not.toContain('bg-transparent');
  });
});
