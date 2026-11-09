import type { OfferDetails, WorkArrangement } from '../data/types';

/** Remote, hybrid or on-site, in the order they're offered. */
export const WORK_ARRANGEMENTS: readonly WorkArrangement[] = ['remote', 'hybrid', 'on-site'];

/** Offices offered as suggestions for the workplace; anything else can be typed. */
export const WORKPLACES = ['New York office'];

export interface WorkLocation {
  arrangement?: WorkArrangement;
  workplace?: string;
}

/**
 * Where the work happens, read from an offer. Older drafts (and what Bolto knows about a role)
 * keep both in one line, e.g. "Hybrid · New York office"; this splits them.
 */
export function readWorkLocation(d: Pick<Partial<OfferDetails>, 'workLocation' | 'workplace'>): WorkLocation {
  const raw = d.workLocation?.trim() ?? '';
  const [head, ...rest] = raw.split(/\s*[·,]\s*/);
  const word = head.toLowerCase().replace(/\s+/g, '-');
  const arrangement: WorkArrangement | undefined =
    word === 'remote'
      ? 'remote'
      : word === 'hybrid'
        ? 'hybrid'
        : word === 'on-site' || word === 'onsite' || word === 'in-office'
          ? 'on-site'
          : undefined;
  // Free text that isn't an arrangement is the workplace itself.
  const fromLine = arrangement ? rest.join(', ') : raw;
  const workplace = d.workplace?.trim() || fromLine || undefined;
  return { arrangement, workplace: arrangement === 'remote' ? undefined : workplace };
}

/** "Hybrid, New York office" / "Remote", for summaries. */
export function describeWorkLocation(d: Pick<Partial<OfferDetails>, 'workLocation' | 'workplace'>) {
  const { arrangement, workplace } = readWorkLocation(d);
  const label = arrangement && arrangement[0].toUpperCase() + arrangement.slice(1);
  return [label, workplace].filter(Boolean).join(', ');
}
