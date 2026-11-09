import type { CSSProperties } from 'react';
import { OFFER_STATUS } from '../../data/offerStatus';
import type { OfferStatus } from '../../data/types';
import styles from './StatusPill.module.css';

export function StatusPill({ status }: { status: OfferStatus }) {
  const { label, color } = OFFER_STATUS[status];
  return (
    <span className={styles.pill} style={{ '--dot-color': color } as CSSProperties}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
