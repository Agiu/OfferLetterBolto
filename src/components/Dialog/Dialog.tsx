import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

/** Keeps the last two words together, so a title that wraps ends on two words, never one. */
const bindLastWords = (title: ReactNode) =>
  typeof title === 'string' ? title.replace(/\s+(\S+)\s*$/, '\u00a0$1') : title;

interface DialogProps {
  open: boolean;
  title: ReactNode;
  /** Called on Escape, and by whichever action means "never mind". */
  onClose: () => void;
  children?: ReactNode;
  /** Buttons along the bottom, primary last. */
  actions: ReactNode;
}

/**
 * A modal over the page, built on the native <dialog>: it traps focus, closes on Escape and
 * puts everything behind it out of reach for keyboard and screen reader users.
 */
export function Dialog({ open, title, onClose, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <h2 id={titleId} className={styles.title}>
            {bindLastWords(title)}
          </h2>
          {children && <div className={styles.body}>{children}</div>}
          <div className={styles.actions}>{actions}</div>
        </>
      )}
    </dialog>
  );
}
