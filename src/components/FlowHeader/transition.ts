/**
 * Router state that carries the blue band from one step of the flow to the next, so it can
 * animate between its heights instead of jumping.
 */
export interface FlowTransitionState {
  /** Where the blue reached (px from the top of the window) on the page we came from. */
  blueFrom?: number;
  /** The band grows: unroll what sits under the bar (set up letter → pick template). */
  reveal?: boolean;
}

/** How long what's on the blue takes to fade away before moving on (see FlowHeader's .leaving). */
export const LEAVE_DURATION = 260;

/** Resolves once the blue's contents have faded away (at once for people who prefer less motion). */
export function afterLeaving(): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => window.setTimeout(resolve, reduce ? 0 : LEAVE_DURATION));
}

/** How far down the window the blue band reaches right now, title and carousel included. */
export function measureBlue(): number {
  const parts = document.querySelectorAll<HTMLElement>('[data-flow-blue]');
  let bottom = 0;
  parts.forEach((part) => {
    bottom = Math.max(bottom, part.getBoundingClientRect().bottom);
  });
  return Math.round(Math.min(Math.max(bottom, 0), window.innerHeight));
}
