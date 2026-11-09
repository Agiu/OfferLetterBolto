import { Check } from 'lucide-react';
import { tokens } from '../../theme/tokens';
import styles from './Timeline.module.css';

export type StepStatus = 'done' | 'current' | 'upcoming';

export interface TimelineStep {
  id: string;
  label: string;
  status: StepStatus;
  /** When set, the step is clickable so people can jump around the flow. */
  onSelect?: () => void;
}

interface TimelineProps {
  steps: readonly TimelineStep[];
  /** onPrimary: white on the Bolto-blue header band, no connector lines (Figma 2043:320). */
  tone?: 'default' | 'onPrimary';
}

export function Timeline({ steps, tone = 'default' }: TimelineProps) {
  return (
    <ol
      className={[styles.timeline, tone === 'onPrimary' && styles.onPrimary].filter(Boolean).join(' ')}
      aria-label="Offer steps"
    >
      {steps.map((step, index) => {
        const content = (
          <>
            <span className={styles.marker} aria-hidden="true">
              {step.status === 'done' ? (
                <Check size={12} strokeWidth={tokens.icon.strokeWidth * 2} />
              ) : (
                index + 1
              )}
            </span>
            <span className={styles.label}>
              {step.label}
              {step.status === 'done' && <span className="visually-hidden"> (done)</span>}
            </span>
          </>
        );
        return (
          <li
            key={step.id}
            className={`${styles.step} ${styles[step.status]}`}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            {step.onSelect ? (
              <button type="button" className={styles.target} onClick={step.onSelect}>
                {content}
              </button>
            ) : (
              <span className={styles.target}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
