'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

type Target = { top: number; height: number } | null;

type SlidingIndicatorProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  activeSelector: string;
  hoverSelector?: string;
};

export function SlidingIndicator({
  containerRef,
  activeSelector,
  hoverSelector,
}: SlidingIndicatorProps) {
  const pathname = usePathname();
  const [target, setTarget] = React.useState<Target>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const measureActive = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(activeSelector);
    if (!el) {
      setTarget(null);
      return;
    }
    setTarget({ top: el.offsetTop, height: el.offsetHeight });
  }, [containerRef, activeSelector]);

  // Re-measure on route change — pathname is intentionally listed to trigger on navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers DOM re-measure
  React.useLayoutEffect(() => {
    measureActive();
  }, [pathname, measureActive]);

  // Re-measure on container resize (sidebar collapse/expand)
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measureActive());
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, measureActive]);

  // Follow hover — fall back to active on mouse-leave
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !hoverSelector) return;

    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(hoverSelector);
      if (!el) return;
      setTarget({ top: el.offsetTop, height: el.offsetHeight });
    };
    const onLeave = () => measureActive();

    container.addEventListener('mouseover', onOver);
    container.addEventListener('mouseleave', onLeave);
    return () => {
      container.removeEventListener('mouseover', onOver);
      container.removeEventListener('mouseleave', onLeave);
    };
  }, [containerRef, hoverSelector, measureActive]);

  if (!target) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-1 rounded-md bg-sidebar-accent"
      style={{
        // Only transform is transitioned — height is set without animation (uniform item heights)
        transform: `translateY(${target.top}px)`,
        height: target.height,
        opacity: 1,
        transition: reducedMotion
          ? 'none'
          : 'transform var(--duration-fast) var(--ease-standard), opacity var(--duration-fast) linear',
      }}
    />
  );
}
