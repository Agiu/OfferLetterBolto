import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown, Search } from 'lucide-react';
import type { Candidate } from '../../data/types';
import { tokens } from '../../theme/tokens';
import { Button } from '../Button/Button';
import styles from './CreateOfferMenu.module.css';

const ICON_SIZE = parseInt(tokens.icon.size.sm, 10);
const STROKE = tokens.icon.strokeWidth;

interface CreateOfferMenuProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
}

/** "Create offer letter" button that opens a searchable list of candidates already in Bolto. */
export function CreateOfferMenu({ candidates, onSelect }: CreateOfferMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.name, c.email, c.jobTitle].some((field) => field.toLowerCase().includes(q)),
    );
  }, [candidates, query]);

  const activeCandidate = results[activeIndex];
  const optionId = (candidate: Candidate) => `${listId}-${candidate.id}`;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  // Close when clicking anywhere outside the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (candidate: Candidate) => {
    onSelect(candidate);
    close();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (results.length) setActiveIndex((i) => (i + 1) % results.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (results.length) setActiveIndex((i) => (i - 1 + results.length) % results.length);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeCandidate) choose(activeCandidate);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <Button
        ref={buttonRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        trailingIcon={
          <ChevronDown
            size={ICON_SIZE}
            strokeWidth={STROKE}
            aria-hidden="true"
            className={[styles.chevron, open && styles.chevronOpen].filter(Boolean).join(' ')}
          />
        }
      >
        Create offer letter
      </Button>

      {open && (
        <div id={panelId} role="dialog" aria-label="Choose a candidate" className={styles.panel}>
          <label className={styles.search}>
            <Search size={ICON_SIZE} strokeWidth={STROKE} aria-hidden="true" />
            <span className="visually-hidden">Search candidates</span>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeCandidate ? optionId(activeCandidate) : undefined}
              placeholder="Search candidates"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              className={styles.input}
            />
          </label>

          <p className={styles.groupLabel} id={`${listId}-label`}>
            Candidates
          </p>

          <ul id={listId} role="listbox" aria-labelledby={`${listId}-label`} className={styles.list}>
            {results.map((candidate, index) => (
              <li
                key={candidate.id}
                id={optionId(candidate)}
                role="option"
                aria-selected={index === activeIndex}
                className={[styles.option, index === activeIndex && styles.optionActive]
                  .filter(Boolean)
                  .join(' ')}
                // Keep focus in the search box so keyboard navigation keeps working.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(candidate)}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionName}>{candidate.name}</span>
                  <span className={styles.optionMeta}>{candidate.jobTitle}</span>
                </span>
                <ArrowRight
                  size={ICON_SIZE}
                  strokeWidth={STROKE}
                  aria-hidden="true"
                  className={styles.optionArrow}
                />
              </li>
            ))}
          </ul>

          {results.length === 0 && (
            <p className={styles.empty} role="status">
              {candidates.length === 0
                ? 'Every candidate already has an offer.'
                : `No candidates match “${query.trim()}”.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
