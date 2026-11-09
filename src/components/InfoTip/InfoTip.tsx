import { useId, useState, type KeyboardEvent } from 'react';
import { Info } from 'lucide-react';
import { tokens } from '../../theme/tokens';
import styles from './InfoTip.module.css';

interface InfoTipProps {
  /** Accessible name for the trigger, e.g. "About W-2". */
  label: string;
  children: string;
  className?: string;
}

/** Info icon that explains something on hover, focus or tap. */
export function InfoTip({ label, children, className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(' ')}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tipId}
        className={styles.trigger}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <Info size={parseInt(tokens.icon.size.sm, 10)} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />
      </button>
      <span id={tipId} role="tooltip" className={styles.tip} data-open={open}>
        {children}
      </span>
    </span>
  );
}
