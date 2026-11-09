import tokens from '../../tokens.json';

// tokens.json is the single source of truth. Every leaf becomes a CSS custom
// property named after its path, e.g. color.text.primary -> --color-text-primary,
// component.button.paddingX -> --component-button-padding-x.

export { tokens };
export type Tokens = typeof tokens;

// Documentation-only keys that shouldn't become CSS variables.
const SKIPPED_KEYS = new Set(['usage', 'library']);

const toKebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function flatten(node: unknown, path: string[], out: Record<string, string>) {
  if (node === null || typeof node !== 'object') {
    out[`--${path.map(toKebab).join('-')}`] = String(node);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || SKIPPED_KEYS.has(key)) continue;
    flatten(value, [...path, key], out);
  }
}

export const cssVariables: Record<string, string> = {};
flatten(tokens, [], cssVariables);

export function applyTokens(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(cssVariables)) {
    root.style.setProperty(name, value);
  }
}
