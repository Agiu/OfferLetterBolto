import { useRef, type KeyboardEvent } from 'react';
import type { OfferFilter, OfferFilterId } from '../../data/offerStatus';
import styles from './OfferTabs.module.css';

interface OfferTabsProps {
  filters: readonly OfferFilter[];
  counts: Record<OfferFilterId, number>;
  value: OfferFilterId;
  onChange: (id: OfferFilterId) => void;
  panelId: string;
}

export function OfferTabs({ filters, counts, value, onChange, panelId }: OfferTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const next = (index + filters.length) % filters.length;
    onChange(filters[next].id);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: filters.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key]);
    }
  };

  return (
    <div role="tablist" aria-label="Filter offers by status" className={styles.tabs}>
      {filters.map((filter, index) => {
        const selected = filter.id === value;
        return (
          <button
            key={filter.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${filter.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(filter.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {filter.label}
            {/* Only the selected tab shows its count; it remounts, and so animates in, on each selection.
                Other tabs keep theirs for screen readers. */}
            <span className={selected ? styles.count : 'visually-hidden'}>{counts[filter.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
