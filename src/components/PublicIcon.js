import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  SOLID_ICONS,
  BRAND_ICONS,
  REGULAR_ICONS,
  FALLBACK_ICON,
} from '@/lib/publicIconMap';

/**
 * Public-safe FontAwesome SVG compatibility renderer.
 *
 * Accepts CMS values (e.g. "fa-building", "fa-location-dot", "fa-facebook-f"),
 * full class strings (e.g. "fa-solid fa-location-dot", "fa-brands fa-facebook-f"),
 * or separate name/family props.
 *
 * Tree-shaken SVG output: 0 external CDN requests, 0 .woff2 font downloads.
 */
export default function PublicIcon({
  iconClass,
  name,
  icon,
  family,
  className,
  style,
  ariaHidden,
  ...rest
}) {
  let detectedFamily = family || null;
  let iconName = name || icon || null;
  const extraClasses = [];

  // Parse class string if provided
  if (iconClass) {
    const tokens = String(iconClass).trim().split(/\s+/);
    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();
      if (lower === 'fa-solid' || lower === 'fas') {
        detectedFamily = 'solid';
      } else if (lower === 'fa-brands' || lower === 'fab') {
        detectedFamily = 'brands';
      } else if (lower === 'fa-regular' || lower === 'far') {
        detectedFamily = 'regular';
      } else if (
        lower.startsWith('fa-') &&
        ![
          'fa-spin',
          'fa-pulse',
          'fa-fw',
          'fa-2x',
          'fa-3x',
          'fa-4x',
          'fa-5x',
          'fa-lg',
          'fa-sm',
          'fa-xs',
          'fa-2xs',
          'fa-xl',
          'fa-2xl',
        ].includes(lower)
      ) {
        if (!iconName) {
          iconName = token;
        } else {
          extraClasses.push(token);
        }
      } else {
        extraClasses.push(token);
      }
    }
  }

  // Merge external className
  if (className) {
    const tokens = String(className).trim().split(/\s+/);
    for (const token of tokens) {
      if (token) extraClasses.push(token);
    }
  }

  let def = null;
  if (iconName) {
    const raw = String(iconName).trim();
    const cleanKey = (raw.startsWith('fa-') ? raw : `fa-${raw}`).toLowerCase();
    const baseKey = cleanKey.replace(/^fa-/, '');

    if (detectedFamily === 'regular') {
      def = REGULAR_ICONS[cleanKey] || REGULAR_ICONS[baseKey];
    } else if (detectedFamily === 'brands') {
      def = BRAND_ICONS[cleanKey] || BRAND_ICONS[baseKey];
    } else if (detectedFamily === 'solid') {
      def = SOLID_ICONS[cleanKey] || SOLID_ICONS[baseKey];
    }

    if (!def) {
      // Auto-detect priority: solid -> brands -> regular
      def =
        SOLID_ICONS[cleanKey] ||
        SOLID_ICONS[baseKey] ||
        BRAND_ICONS[cleanKey] ||
        BRAND_ICONS[baseKey] ||
        REGULAR_ICONS[cleanKey] ||
        REGULAR_ICONS[baseKey];
    }

    if (!def && process.env.NODE_ENV !== 'production') {
      console.warn(`[PublicIcon] Unknown icon: "${iconName}" (class: "${iconClass}")`);
    }
  }

  if (!def) {
    def = FALLBACK_ICON;
  }

  const computedClassName = extraClasses.length > 0 ? extraClasses.join(' ') : undefined;
  const isAriaHidden = ariaHidden !== undefined ? ariaHidden : rest['aria-label'] ? undefined : true;

  return (
    <FontAwesomeIcon
      icon={def}
      className={computedClassName}
      style={style}
      aria-hidden={isAriaHidden}
      {...rest}
    />
  );
}
