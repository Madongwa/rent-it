/**
 * Spectrum UI — MetalButton (adapted for this Vite + JS project: no
 * TypeScript, no "use client" (that's a Next.js App Router concept), and
 * @/lib/utils swapped for a relative import since this project has no `@`
 * path alias configured).
 *
 * A pill button framed by a real-time liquid-metal ring, painted by
 * `metal-fx` (Jakub Antalik, MIT, https://metal.jakubantalik.com): one
 * shared WebGL shader drives every instance on the page, pauses offscreen,
 * and renders a transparent placeholder on the server.
 *
 * Not currently used directly anywhere in the app - see metal-nav-link.jsx
 * for the variant actually wired into the navbar. Kept as the base
 * component per the integration spec, for any future standalone button use.
 */

import * as React from 'react';
import { MetalFx } from 'metal-fx';

import { cn } from '../../lib/utils';
import { useSurfaceTheme } from './metal-button-utils/use-surface-theme';

const SIZE = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
};

export function MetalButton({
  preset = 'chromatic',
  theme = 'auto',
  strength = 1,
  size = 'md',
  paused = false,
  className,
  wrapperClassName,
  children,
  type = 'button',
  ...props
}) {
  const resolved = useSurfaceTheme(theme);
  return (
    <MetalFx
      variant="button"
      preset={preset}
      theme={resolved}
      strength={strength}
      paused={paused}
      className={cn('inline-flex', wrapperClassName)}
    >
      <button
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] transition-[transform,background-color] duration-200 ease-out',
          // metal-fx keeps the host fill transparent so the ring frames the page surface; only the label carries the theme
          'text-neutral-900 hover:opacity-80 active:scale-[0.97] dark:text-white',
          'focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-60',
          SIZE[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    </MetalFx>
  );
}

export default MetalButton;
