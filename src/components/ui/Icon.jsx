import React from 'react';

/**
 * Icon — Material Symbols Outlined wrapper
 *
 * @param {string}  name    — Material symbol name, e.g. "home", "payments", "add_circle"
 * @param {0|1}     fill    — 0 = outlined (default), 1 = filled
 * @param {number}  weight  — stroke weight 100–700 (default 400)
 * @param {number}  grade   — -50..200 (default 0)
 * @param {number}  size    — optical size 20|24|40|48 (default 24), also sets font-size in px
 * @param {string}  className — extra Tailwind classes
 */
export default function Icon({
  name,
  fill = 0,
  weight = 400,
  grade = 0,
  size = 24,
  className = '',
  style,
  ...props
}) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ''}`}
      style={{
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${size}`,
        fontSize: size,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}
