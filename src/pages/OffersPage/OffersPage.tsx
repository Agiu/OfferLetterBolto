import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { CreateOfferMenu } from '../../components/CreateOfferMenu/CreateOfferMenu';
import { OfferCard } from '../../components/OfferCard/OfferCard';
import { OfferTabs } from '../../components/OfferTabs/OfferTabs';
import { useOffers } from '../../data/OffersContext';
import { OFFER_FILTERS, matchesFilter, type OfferFilterId } from '../../data/offerStatus';
import { tokens } from '../../theme/tokens';
import styles from './OffersPage.module.css';

const ICON_SIZE = parseInt(tokens.icon.size.sm, 10);

/** Navigation state set by the create flow when it hands an offer back to the list. */
export interface OffersPageState {
  /** Offer to highlight. */
  createdOfferId?: string;
  /** What to announce, e.g. "Draft saved for Alex Rivera." Defaults to a new-draft message. */
  announcement?: string;
}

export function OffersPage() {
  const { offers, availableCandidates, load } = useOffers();
  const navigate = useNavigate();
  const { createdOfferId, announcement: handedBack } = (useLocation().state ?? {}) as OffersPageState;
  const [filterId, setFilterId] = useState<OfferFilterId>('all');
  const [announcement, setAnnouncement] = useState('');
  const panelId = useId();

  const createdOffer = offers.find((o) => o.id === createdOfferId);

  // Set after mount so screen readers announce it.
  useEffect(() => {
    if (createdOffer) setAnnouncement(handedBack ?? `Draft offer created for ${createdOffer.candidate.name}.`);
  }, [createdOffer, handedBack]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        OFFER_FILTERS.map((f) => [f.id, offers.filter((o) => matchesFilter(f, o.status)).length]),
      ) as Record<OfferFilterId, number>,
    [offers],
  );

  const filter = OFFER_FILTERS.find((f) => f.id === filterId)!;
  const visibleOffers = offers.filter((o) => matchesFilter(filter, o.status));

  return (
    <>
      {/* This list is only here to start and end the journey; it isn't the designed part. */}
      <aside className={styles.disclaimer} role="note" aria-label="About this page">
        <div className={styles.disclaimerInner}>
          <Info size={ICON_SIZE} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" className={styles.disclaimerIcon} />
          <p>
            <strong>Disclaimer:</strong> this page was only created for user journey purposes. It hasn’t been fully
            designed.
          </p>
        </div>
      </aside>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>Offer letters</h1>
          <CreateOfferMenu
            candidates={availableCandidates}
            onSelect={(candidate) => navigate(`/offers/new/${candidate.id}`)}
          />
        </div>
      </header>

      <main className={styles.main}>
        <OfferTabs
          filters={OFFER_FILTERS}
          counts={counts}
          value={filterId}
          onChange={setFilterId}
          panelId={panelId}
        />

        <section
          id={panelId}
          role="tabpanel"
          aria-labelledby={`tab-${filterId}`}
          className={styles.list}
        >
          {load.status === 'loading' && <p className={styles.empty}>Loading offers…</p>}
          {load.status === 'error' && (
            <p role="alert" className={styles.empty}>
              Couldn’t load offers: {load.message}
            </p>
          )}
          {load.status === 'ready' && (
            <>
              {visibleOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} isNew={offer.id === createdOfferId} />
              ))}
              {visibleOffers.length === 0 && (
                <p className={styles.empty}>
                  {offers.length === 0
                    ? 'No offer letters yet. Choose “Create offer letter” to start one.'
                    : `No ${filter.label.toLowerCase()} offers.`}
                </p>
              )}
            </>
          )}
        </section>
      </main>

      <div className={styles.fade} aria-hidden="true" />
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
