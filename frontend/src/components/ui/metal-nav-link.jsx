/**
 * MetalNavLink — the routing-link counterpart to MetalButton.
 *
 * metal-button.jsx wraps a plain <button>, which would break navigation if
 * used for our nav items. This wraps react-router's <NavLink> instead, so
 * clicking still navigates and the existing active-route styling still
 * applies - MetalFx only adds the liquid-metal ring on top, it doesn't own
 * routing or color.
 *
 * Deliberately does NOT set text color, font-size, hover, active-state color,
 * or the entrance-animation classes here - `.rh-nav-links a` in
 * home-hero.css already owns all of that (color, weight, letter-spacing,
 * hover/`.is-active`, the rh-liftIn entrance animation) via a plain
 * descendant selector that still matches the <a> NavLink renders no matter
 * how many wrapper divs MetalFx puts around it. Duplicating those properties
 * here in Tailwind would just lose a CSS specificity fight against that
 * existing rule for no benefit. This component only adds what didn't exist
 * before: the pill's own box shape (height/padding/rounded corners) for
 * MetalFx's ring to frame, sized smaller than MetalButton's own SIZE map
 * since a nav link needs less padding than a standalone button.
 */

import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { MetalFx } from 'metal-fx';

import { cn } from '../../lib/utils';
import { useSurfaceTheme } from './metal-button-utils/use-surface-theme';

const NAV_SIZE = {
  sm: 'h-8 px-3',
  md: 'h-9 px-3.5',
  lg: 'h-10 px-4',
};

export function MetalNavLink({
  to,
  end,
  children,
  preset = 'chromatic',
  // Our navbar background is unconditionally dark glass on every page (see
  // Navbar.jsx / .rh-nav) - never toggled by a class or by anything the
  // visitor controls. "auto" would instead follow the visitor's OS
  // prefers-color-scheme, which has nothing to do with our navbar's own
  // fixed-dark background, so this pins "dark" rather than defaulting to
  // "auto" like MetalButton does.
  theme = 'dark',
  strength = 1,
  size = 'sm',
  paused = false,
  className,
  wrapperClassName,
  style,
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
      <NavLink
        to={to}
        end={end}
        style={style}
        className={({ isActive }) =>
          cn('inline-flex items-center justify-center rounded-full', NAV_SIZE[size], isActive ? 'is-active' : '', className)
        }
        {...props}
      >
        {children}
      </NavLink>
    </MetalFx>
  );
}

export default MetalNavLink;
