/**
 * The flow in four phases, from the wireframe (Figma 2043:299), shown in the blue header on the
 * template and set-up pages.
 */
export const OFFER_PHASES = [
  { id: 'template', label: 'Pick template' },
  { id: 'setup', label: 'Set up letter' },
  { id: 'review', label: 'Review letter' },
  { id: 'send', label: 'Send offer letter' },
] as const;
