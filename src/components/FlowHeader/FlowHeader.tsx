import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import boltoLogo from '../../assets/bolto-logo.svg';
import { tokens } from '../../theme/tokens';
import { Timeline, type TimelineStep } from '../Timeline/Timeline';
import styles from './FlowHeader.module.css';

interface FlowHeaderProps {
  steps: readonly TimelineStep[];
  /** Right-hand side of the bar, e.g. the layout toggle. */
  aside?: ReactNode;
  /** Shown under the bar on the same blue, e.g. the page title. Scrolls away; the bar stays. */
  children?: ReactNode;
  /**
   * Arriving from a page whose blue reached this far down (px): the blue starts there and
   * shrinks to this page's band.
   */
  morphFrom?: number;
  /** Arriving from a page with a shorter band: what sits under the bar unrolls into place. */
  reveal?: boolean;
  /** Moving on to a page with a shorter band: what sits under the bar, and the aside, fade away. */
  leaving?: boolean;
}

const ICON_SIZE = parseInt(tokens.icon.size.sm, 10);

/**
 * Bolto-blue band across the top of the offer flow (Figma 2043:299, 2045:214): logo and the
 * way back to the list on the left, the flow's phases in the middle column, `aside` on the right.
 * The bar is pinned to the top of the window.
 */
export function FlowHeader({ steps, aside, children, morphFrom, reveal = false, leaving = false }: FlowHeaderProps) {
  const bandRef = useRef<HTMLElement>(null);

  // Publish the pinned bar's height (it wraps to two or three rows on narrower screens) so
  // focus and in-page scrolling stop below it, not under it.
  useLayoutEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--flow-header-height', `${band.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(band);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--flow-header-height');
    };
  }, []);

  return (
    <>
      <header ref={bandRef} className={styles.band} data-flow-blue="">
        {morphFrom !== undefined && (
          <div
            className={styles.morph}
            style={{ '--morph-from': `${morphFrom}px` } as CSSProperties}
            aria-hidden="true"
          />
        )}
        <div className={styles.bar}>
          <div className={styles.brand}>
            {/* The logo also leads back to the list: on phones it's the only way there in the bar. */}
            <Link to="/" className={styles.logoLink} aria-label="Bolto, back to offer letters">
              <img src={boltoLogo} width={63} height={14} alt="" className={styles.logo} />
            </Link>
            <Link to="/" className={styles.back}>
              <ArrowLeft size={ICON_SIZE} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />
              Offer letters
            </Link>
          </div>
          <div className={styles.steps}>
            <Timeline steps={steps} tone="onPrimary" />
          </div>
          <div className={[styles.aside, leaving && styles.leaving].filter(Boolean).join(' ')}>{aside}</div>
        </div>
      </header>
      {children && (
        <div className={[styles.extension, reveal && styles.reveal, leaving && styles.leavingChildren].filter(Boolean).join(' ')} data-flow-blue="">
          {children}
        </div>
      )}
    </>
  );
}
