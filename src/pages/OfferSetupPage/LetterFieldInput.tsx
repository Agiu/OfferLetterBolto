import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { tokens } from '../../theme/tokens';
import type { TemplateId } from '../../data/types';
import { SECTION_OF } from '../../data/offerSections';
import type { FieldKey } from '../../lib/letter';
import { WORK_ARRANGEMENTS, WORKPLACES } from '../../lib/workLocation';
import { defaultBasis, readField, writeField, writePayBasis, type Draft } from './draft';
import styles from './OfferSetupPage.module.css';

interface LetterFieldInputProps {
  fieldKey: FieldKey;
  /** What the field is, e.g. "Start date". Its accessible name and placeholder. */
  label: string;
  draft: Draft;
  templateId: TemplateId;
  onChange: (draft: Draft) => void;
  /** Still to fill in. */
  missing: boolean;
  /**
   * The same detail already appeared earlier in the letter (job title, expiry date, sender name,
   * FLSA status). Screen readers hear that it's a repeat, so a second box with the same name
   * doesn't sound like a separate detail.
   */
  repeat?: boolean;
}

/** Id of the hidden "Still to fill in." text that missing fields point to (see OfferSetupPage). */
export const MISSING_HINT_ID = 'field-missing-hint';

/**
 * What each detail is called, for screen readers. The visible placeholder isn't always a name
 * ("Exempt or non-exempt" is the choice, "FLSA status" is the detail).
 */
const ACCESSIBLE_NAMES: Partial<Record<FieldKey, string>> = {
  employmentType: 'Employment type',
  flsa: 'FLSA status',
  workLocation: 'Work location',
  reportsTo: 'Reports to',
  startDate: 'Start date',
  endsOn: 'End date',
  expiresOn: 'Offer expiry date',
};

/** Details that can stay blank, so they're never marked required. */
const OPTIONAL_KEYS = new Set<FieldKey>(['signingBonus', 'bonusRepay', 'equity']);

const TEXT_FIELDS = new Set<FieldKey>([
  'title',
  'candidateFirstName',
  'candidateLastName',
  'candidateEmail',
  'jobTitle',
  'department',
  'reportsTo',
  'workplace',
  'equity',
  'senderName',
  'senderTitle',
  'senderEmail',
]);
const EMAIL_FIELDS = new Set<FieldKey>(['candidateEmail', 'senderEmail']);
const DATE_FIELDS = new Set<FieldKey>(['startDate', 'endsOn', 'expiresOn']);

/** Suggestions offered while typing; anything else can be typed. */
const SUGGESTIONS: Partial<Record<FieldKey, string[]>> = {
  department: ['Engineering', 'Design', 'Product', 'Sales', 'Marketing', 'Operations', 'People'],
  workplace: WORKPLACES,
};

/** Optional details, where blank means none: they read "None" until filled in. */
const OPTIONAL_LABELS: Partial<Record<FieldKey, string>> = {
  equity: 'Equity (leave blank for none)',
};

/**
 * Sizes a text box to its value (or its placeholder while empty), so it sits in the sentence like a
 * word. Browsers with `field-sizing` measure the text exactly (see .field in the CSS); this
 * character estimate is the fallback for the others.
 */
const widthFor = (value: string, placeholder: string, extra = 1): CSSProperties =>
  ({
    // Characters, plus the field's padding and border on both sides.
    '--field-width': `calc(${Math.max(value ? value.length : placeholder.length, 2) + extra}ch + 2 * var(--space-2) + 2px)`,
  }) as CSSProperties;

const CHEVRON_SIZE = parseInt(tokens.icon.size.sm, 10);

/** A dropdown with the design system's chevron in place of the browser's arrow. */
export function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <span className={styles.selectWrap}>
      {children}
      <ChevronDown size={CHEVRON_SIZE} strokeWidth={tokens.icon.strokeWidth} className={styles.chevron} aria-hidden="true" />
    </span>
  );
}

/** A detail of the offer, edited where it appears in the letter. Missing details are tinted. */
export function LetterFieldInput({
  fieldKey,
  label,
  draft,
  templateId,
  onChange,
  missing,
  repeat = false,
}: LetterFieldInputProps) {
  const value = readField(draft, fieldKey);
  const set = (next: string) => onChange(writeField(draft, fieldKey, next, templateId));
  const className = [styles.field, missing && styles.missing].filter(Boolean).join(' ');
  const name = ACCESSIBLE_NAMES[fieldKey] ?? label;
  const spoken = (base: string) => (repeat ? `${base} (same as earlier in the letter)` : base);
  const shared = {
    'aria-label': spoken(name),
    'aria-required': OPTIONAL_KEYS.has(fieldKey) ? undefined : true,
    'aria-describedby': missing ? MISSING_HINT_ID : undefined,
    'data-field-key': fieldKey,
    'data-section': SECTION_OF[fieldKey],
    'data-missing': missing || undefined,
  };

  // The title can be long: it wraps onto a second line instead of running off the page.
  if (fieldKey === 'title') {
    return (
      <textarea
        {...shared}
        value={value}
        placeholder={label}
        rows={1}
        onChange={(e) => set(e.target.value.replace(/\s*[\r\n]+\s*/g, ' '))}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        className={`${className} ${styles.wide}`}
        spellCheck
      />
    );
  }

  if (TEXT_FIELDS.has(fieldKey)) {
    const suggestions = SUGGESTIONS[fieldKey];
    const listId = suggestions ? `suggestions-${fieldKey}` : undefined;
    return (
      <>
        <input
          {...shared}
          aria-label={spoken(OPTIONAL_LABELS[fieldKey] ?? name)}
          type={EMAIL_FIELDS.has(fieldKey) ? 'email' : 'text'}
          inputMode={EMAIL_FIELDS.has(fieldKey) ? 'email' : undefined}
          spellCheck={EMAIL_FIELDS.has(fieldKey) ? false : undefined}
          value={value}
          placeholder={label}
          onChange={(e) => set(e.target.value)}
          list={listId}
          className={className}
          style={widthFor(value, label)}
          autoComplete="off"
        />
        {listId && (
          <datalist id={listId}>
            {suggestions!.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        )}
      </>
    );
  }

  if (DATE_FIELDS.has(fieldKey)) {
    return (
      <input {...shared} type="date" value={value} onChange={(e) => set(e.target.value)} className={`${className} ${styles.date}`} />
    );
  }

  if (fieldKey === 'employmentType' || fieldKey === 'flsa' || fieldKey === 'workLocation') {
    const options =
      fieldKey === 'employmentType'
        ? ['full-time', 'part-time']
        : fieldKey === 'flsa'
          ? ['exempt', 'non-exempt']
          : [...WORK_ARRANGEMENTS];
    return (
      <SelectWrap>
        <select {...shared} value={value} onChange={(e) => set(e.target.value)} className={`${className} ${styles.select}`}>
          <option value="">{label}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </SelectWrap>
    );
  }

  if (fieldKey === 'pay') {
    const basis = draft.pay?.basis ?? defaultBasis(templateId);
    return (
      <span className={styles.compound}>
        $
        <input
          {...shared}
          type="text"
          inputMode="numeric"
          value={value ? Number(value).toLocaleString('en-US') : ''}
          placeholder={label}
          onChange={(e) => set(e.target.value)}
          className={className}
          style={widthFor(value ? Number(value).toLocaleString('en-US') : '', label, 0.5)}
        />
        <SelectWrap>
          <select
            aria-label="Pay period"
            data-section="compensation"
            value={basis}
            onChange={(e) => onChange(writePayBasis(draft, e.target.value as 'salary' | 'hourly'))}
            className={`${styles.field} ${styles.select}`}
          >
            <option value="salary">per year</option>
            <option value="hourly">per hour</option>
          </select>
        </SelectWrap>
      </span>
    );
  }

  // Signing bonus amount and months to repay: numbers.
  const display = fieldKey === 'signingBonus' && value ? Number(value).toLocaleString('en-US') : value;
  const placeholder = fieldKey === 'signingBonus' ? 'None' : '12';
  return (
    <span className={styles.compound}>
      {fieldKey === 'signingBonus' && '$'}
      <input
        {...shared}
        aria-label={spoken(fieldKey === 'signingBonus' ? 'Signing bonus (leave blank for none)' : 'Months to repay the bonus')}
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        className={className}
        style={widthFor(display, placeholder, 0.5)}
      />
    </span>
  );
}
