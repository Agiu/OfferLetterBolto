import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OFFER_STATUS } from '../../data/offerStatus';
import type { Offer } from '../../data/types';
import { formatDate, formatEmployment, formatPay } from '../../lib/format';
import { StatusPill } from '../StatusPill/StatusPill';
import styles from './OfferCard.module.css';

const NotSet = () => <span className={styles.notSet}>Not set</span>;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  );
}

export function OfferCard({ offer, isNew = false }: { offer: Offer; isNew?: boolean }) {
  const nameId = `${offer.id}-name`;
  // Offers that haven't gone out can still be set up.
  const editable = offer.status === 'draft' || offer.status === 'ready';
  const role = [offer.jobTitle, offer.employment && formatEmployment(offer.employment)]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      aria-labelledby={nameId}
      className={[styles.card, isNew && styles.isNew].filter(Boolean).join(' ')}
      style={{ '--status-color': OFFER_STATUS[offer.status].color } as CSSProperties}
    >
      <div className={styles.person}>
        <h2 id={nameId} className={styles.name}>
          {editable ? (
            // Stretched over the whole card, so anywhere on it opens the letter.
            <Link to={`/offers/${offer.id}/setup`} className={styles.open}>
              {offer.candidate.name}
            </Link>
          ) : (
            offer.candidate.name
          )}
        </h2>
        <p className={styles.role}>{role}</p>
      </div>

      <dl className={styles.facts}>
        <Fact label="Pay">{offer.pay ? formatPay(offer.pay) : <NotSet />}</Fact>
        <Fact label="Start date">{offer.startDate ? formatDate(offer.startDate) : <NotSet />}</Fact>
      </dl>

      <div className={styles.status}>
        <StatusPill status={offer.status} />
        <p className={styles.statusDate}>
          {OFFER_STATUS[offer.status].dateLabel} {formatDate(offer.statusChangedOn)}
        </p>
      </div>
    </article>
  );
}
