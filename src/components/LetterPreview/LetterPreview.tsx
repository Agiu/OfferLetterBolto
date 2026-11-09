import type { ReactNode } from 'react';
import type { Letter, LetterField, Segment } from '../../lib/letter';
import styles from './LetterPreview.module.css';

interface LetterPreviewProps {
  letter: Letter;
  /** Letter title from the title field, shown live. */
  title: string;
  /** Date the letter is dated, already formatted. */
  dated: string;
  /** Smaller type and margins, for the card-sized carousel. */
  compact?: boolean;
  /** An example letter: details still to fill in read as plain placeholder text, not highlighted gaps. */
  example?: boolean;
  /**
   * Makes the letter editable: called for every detail that has a key (and for the title),
   * and its result is shown in place of the read-only value or gap.
   */
  /** `occurrence` counts from 1: a detail can come up more than once in a letter. */
  renderField?: (field: LetterField, occurrence: number) => ReactNode;
  className?: string;
}

/** A gap naming what still needs filling in. */
function Gap({ field }: { field: LetterField }) {
  return (
    <mark className={styles.gap}>
      <span className="visually-hidden">To fill in: </span>
      {field.field}
    </mark>
  );
}

/**
 * A read-only render of an offer letter, laid out like an email printed to PDF (letterhead,
 * subject, From and To, then the letter), or an editable one with renderField.
 */
export function LetterPreview({ letter, title, dated, compact = false, example = false, renderField, className }: LetterPreviewProps) {
  // How many times each detail has come up so far, top to bottom.
  const seen = new Map<string, number>();
  const fill = (segment: Segment, key?: number) => {
    if (typeof segment === 'string') return segment;
    if (renderField && segment.key && !segment.readOnly) {
      const occurrence = (seen.get(segment.key) ?? 0) + 1;
      seen.set(segment.key, occurrence);
      return <span key={key}>{renderField(segment, occurrence)}</span>;
    }
    if (segment.value !== undefined) return <span key={key}>{segment.value}</span>;
    if (segment.optional) return <span key={key}>{segment.field}</span>;
    if (example)
      return (
        <span key={key}>
          <span className="visually-hidden">To fill in: </span>
          {segment.field}
        </span>
      );
    return <Gap key={key} field={segment} />;
  };
  const segments = (list: Segment[]) => list.map((segment, i) => fill(segment, i));
  // Read-only addresses go in angle brackets, as an email client prints them; fields don't.
  const address = (f: LetterField) =>
    renderField && f.key ? fill(f) : <span className={styles.address}>&lt;{fill(f)}&gt;</span>;
  const { from, to } = letter.envelope;

  return (
    <div className={[styles.paper, compact && styles.compact, className].filter(Boolean).join(' ')}>
      <header className={styles.letterhead}>
        {/* Stand-in for the company's logo and name, which come from the account. */}
        <span className={styles.logo} aria-hidden="true" />
        <span className={styles.company}>Your company</span>
      </header>

      <h3 className={styles.subject}>
        {fill({ field: 'Letter title', value: title.trim() ? title : undefined, key: 'title' })}
      </h3>

      <dl className={styles.envelope}>
        <div className={styles.envelopeRow}>
          <dt className={styles.envelopeLabel}>From</dt>
          <dd className={styles.envelopeValue}>
            <span className={styles.sender}>{fill(from.name)}</span> {address(from.email)}
          </dd>
          <dd className={styles.date}>{dated}</dd>
        </div>
        <div className={styles.envelopeRow}>
          <dt className={styles.envelopeLabel}>To</dt>
          <dd className={styles.envelopeValue}>
            {fill(to.firstName)} {fill(to.lastName)} {address(to.email)}
          </dd>
        </div>
      </dl>

      <div className={styles.body}>
        <p>{segments(letter.greeting)}</p>

        {letter.blocks.map((block, i) => {
          switch (block.kind) {
            case 'heading':
              return (
                <h4 key={i} className={styles.heading}>
                  {block.text}
                </h4>
              );
            case 'paragraph':
              return <p key={i}>{segments(block.segments)}</p>;
            case 'terms':
              return (
                <dl key={i} className={styles.terms}>
                  {block.rows.map((row) => (
                    <div key={row.label} className={styles.term}>
                      <dt>{row.label}</dt>
                      <dd>{fill(row.value)}</dd>
                    </div>
                  ))}
                </dl>
              );
            case 'custom':
              return (
                <div key={i} className={styles.custom}>
                  <span className={styles.line} aria-hidden="true" />
                  <span className={styles.line} aria-hidden="true" />
                  <span className={`${styles.line} ${styles.short}`} aria-hidden="true" />
                  <p className={styles.customNote}>
                    Custom letters use your own wording, built around the key terms below.
                  </p>
                  <span className={styles.line} aria-hidden="true" />
                  <span className={`${styles.line} ${styles.short}`} aria-hidden="true" />
                </div>
              );
          }
        })}
      </div>

      <footer className={styles.signOff}>
        <p>Sincerely,</p>
        <p className={styles.senderName}>{fill(letter.signOff.name)}</p>
        <p className={styles.senderTitle}>{fill(letter.signOff.title)}</p>

        <div className={styles.signatures} aria-hidden="true">
          <span className={styles.signatureLine}>Candidate signature</span>
          <span className={styles.signatureLine}>Date</span>
        </div>
      </footer>
    </div>
  );
}
