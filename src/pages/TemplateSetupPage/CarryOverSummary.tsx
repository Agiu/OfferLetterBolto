import { ArrowRight, Check, Minus, RefreshCw, X } from 'lucide-react';
import type { CarryItem, CarryOutcome } from '../../data/switchTemplate';
import styles from './CarryOverSummary.module.css';

const GROUPS: { outcome: CarryOutcome; title: string; note?: string }[] = [
  { outcome: 'kept', title: 'Comes with you' },
  {
    outcome: 'replaced',
    title: 'Swapped for this letter',
    note: 'Doesn’t fit the new letter, so Bolto fills in what it knows for this role instead.',
  },
  {
    outcome: 'cleared',
    title: 'To fill in again',
    note: 'Doesn’t fit the new letter and Bolto has nothing to replace it with.',
  },
  {
    outcome: 'dropped',
    title: 'Not on this letter',
    note: 'The new letter doesn’t include these, so they’re removed.',
  },
];

const ICON = { kept: Check, replaced: RefreshCw, cleared: X, dropped: Minus } as const;

/** What the saved draft brings to the new letter, in the switch-template dialog. */
export function CarryOverSummary({ items, sameTemplate }: { items: CarryItem[]; sameTemplate: boolean }) {
  if (items.length === 0) {
    return <p>Nothing has been filled in yet, so there’s nothing to carry over.</p>;
  }
  const allKept = items.every((i) => i.outcome === 'kept');

  return (
    <>
      <p>
        {sameTemplate
          ? 'Only the wording changes. Everything in your saved draft comes with you.'
          : allKept
            ? 'Everything in your saved draft comes with you.'
            : 'Here’s what happens to your saved draft on the new letter.'}
      </p>
      {GROUPS.map(({ outcome, title, note }) => {
        const group = items.filter((i) => i.outcome === outcome);
        if (group.length === 0) return null;
        const Icon = ICON[outcome];
        return (
          <section key={outcome} className={`${styles.group} ${styles[outcome]}`}>
            <h3 className={styles.groupTitle}>
              <span className={styles.icon} aria-hidden="true">
                <Icon size={12} strokeWidth={2.5} />
              </span>
              {title}
            </h3>
            {note && <p className={styles.note}>{note}</p>}
            <dl className={styles.list}>
              {group.map((item) => (
                <div key={item.id} className={styles.row}>
                  <dt className={styles.label}>{item.label}</dt>
                  <dd className={styles.value}>
                    {item.after ? (
                      <>
                        <span className={styles.before}>{item.before}</span>
                        <ArrowRight size={14} aria-hidden="true" className={styles.arrow} />
                        <span className="visually-hidden">becomes</span>
                        <span>{item.after}</span>
                      </>
                    ) : (
                      <span className={outcome === 'kept' ? undefined : styles.before}>{item.before}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </>
  );
}
