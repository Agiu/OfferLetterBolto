import type { OfferStatus } from './types';

interface StatusMeta {
  label: string;
  /** Prefix for the status date on a card, e.g. "Signed Jun 2, 2026". */
  dateLabel: string;
  /** Dot colour. The label carries the meaning; the dot only helps scanning. */
  color: string;
}

export const OFFER_STATUS: Record<OfferStatus, StatusMeta> = {
  draft: { label: 'Draft', dateLabel: 'Edited', color: 'var(--color-text-tertiary)' },
  ready: { label: 'Ready to send', dateLabel: 'Ready since', color: 'var(--color-primary-idle)' },
  sent: { label: 'Sent', dateLabel: 'Sent', color: 'var(--color-primary-disabled)' },
  viewed: { label: 'Viewed', dateLabel: 'Viewed', color: 'var(--color-text-link)' },
  signed: { label: 'Signed', dateLabel: 'Signed', color: 'var(--color-info-success)' },
  declined: { label: 'Declined', dateLabel: 'Declined', color: 'var(--color-info-error)' },
  expired: { label: 'Expired', dateLabel: 'Expired', color: 'var(--color-info-warning)' },
  voided: { label: 'Voided', dateLabel: 'Voided', color: 'var(--color-outline-2)' },
};

export type OfferFilterId = 'all' | 'in-progress' | 'awaiting' | 'signed' | 'closed';

export interface OfferFilter {
  id: OfferFilterId;
  label: string;
  /** null matches every status. */
  statuses: readonly OfferStatus[] | null;
}

export const OFFER_FILTERS: readonly OfferFilter[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'in-progress', label: 'In progress', statuses: ['draft', 'ready'] },
  { id: 'awaiting', label: 'Awaiting candidate', statuses: ['sent', 'viewed'] },
  { id: 'signed', label: 'Signed', statuses: ['signed'] },
  { id: 'closed', label: 'Closed', statuses: ['declined', 'expired', 'voided'] },
];

export const matchesFilter = (filter: OfferFilter, status: OfferStatus) =>
  filter.statuses === null || filter.statuses.includes(status);
