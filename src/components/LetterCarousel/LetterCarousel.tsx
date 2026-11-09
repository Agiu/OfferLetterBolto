import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { tokens } from '../../theme/tokens';
import styles from './LetterCarousel.module.css';

export interface LetterSlide {
  id: string;
  /** Short name for the option row, e.g. "W-2 · Concise". */
  label: string;
  /** Full name, e.g. "W-2 employee letter · Concise". Announced when the letter changes. */
  name: string;
  recommended?: boolean;
  content: ReactNode;
}

interface LetterCarouselProps {
  slides: readonly LetterSlide[];
  index: number;
  onChange: (index: number) => void;
  /** Labels the carousel, e.g. the id of a heading. */
  labelledBy: string;
  /** onPrimary: the option row is drawn for the Bolto-blue header band. */
  tone?: 'default' | 'onPrimary';
}

const ICON_SIZE = parseInt(tokens.icon.size.md, 10);
/** Horizontal travel, in px, before a touch drag counts as a swipe. */
const SWIPE_DISTANCE = 48;
/** After a letter lands, wait this long, then glide down it. */
const READ_DELAY = 600;
/** Glide speed, in px per second, within these bounds so short and long letters both read well. */
const READ_SPEED = 55;
const READ_MIN = 2500;
const READ_MAX = 9000;
/** Rest at the bottom and at the top before gliding again. */
const HOLD_BOTTOM = 1400;
const HOLD_TOP = 1000;

/** Slow at both ends, quickest in the middle. */
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/**
 * Three letters side by side, the one in the middle larger (Figma 2043:299). Move between them
 * with the option row (arrow keys work there too), the previous/next buttons, a swipe, or by
 * clicking a letter at either side.
 */
export function LetterCarousel({ slides, index, onChange, labelledBy, tone = 'default' }: LetterCarouselProps) {
  const groupName = useId();
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const current = slides[index];

  // Keep the selected option visible when the row scrolls sideways (phones). Scrolls only the
  // row, never the page.
  useEffect(() => {
    const row = optionsRef.current;
    const option = row?.children[index] as HTMLElement | undefined;
    if (!row || !option || row.scrollWidth <= row.clientWidth) return;
    const left = option.offsetLeft - (row.clientWidth - option.offsetWidth) / 2;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, [index]);

  const stageRef = useRef<HTMLDivElement>(null);
  // Which letter the person stopped, if any. Stopping applies to that letter only: landing on
  // another one plays again, and so does coming back.
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const stopped = stoppedAt === index;
  const canAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Once a letter has landed in the middle, it glides down to the bottom and back up, easing in
  // and out, and keeps looping while it's the one in the middle. Letters at the sides rest at the
  // top. People who prefer reduced motion get the top of the letter and no movement.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sheets = [...stage.querySelectorAll<HTMLElement>('[data-sheet]')];
    sheets.forEach((sheet, i) => {
      if (i !== index) sheet.scrollTop = 0;
    });
    const sheet = sheets[index];
    if (!sheet || stopped || !canAnimate) return;
    sheet.scrollTop = 0; // playing always starts at the top

    let frame = 0;
    let timer = 0;
    const glide = (from: number, to: number, duration: number, done: () => void) => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        sheet.scrollTop = from + (to - from) * easeInOut(t);
        if (t < 1) frame = requestAnimationFrame(step);
        else done();
      };
      frame = requestAnimationFrame(step);
    };
    const later = (ms: number, work: () => void) => {
      timer = window.setTimeout(work, ms);
    };

    const down = () => {
      const distance = sheet.scrollHeight - sheet.clientHeight;
      if (distance <= 0) return; // the whole letter already fits
      const duration = Math.min(READ_MAX, Math.max(READ_MIN, (distance / READ_SPEED) * 1000));
      glide(0, distance, duration, () =>
        later(HOLD_BOTTOM, () => glide(distance, 0, duration, () => later(HOLD_TOP, down))),
      );
    };
    later(READ_DELAY, down);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [index, slides.length, stopped, canAnimate]);

  const go = (next: number) => {
    if (next >= 0 && next < slides.length && next !== index) onChange(next);
  };

  // Rendered twice: in the gaps beside the middle letter on wide screens, either side of the
  // option row on narrow ones. CSS shows one pair.
  const navButton = (direction: 'previous' | 'next', placement: string) => {
    const previous = direction === 'previous';
    const Icon = previous ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        className={`${styles.navButton} ${placement}`}
        onClick={() => go(previous ? index - 1 : index + 1)}
        disabled={previous ? index === 0 : index === slides.length - 1}
        aria-label={previous ? 'Previous letter' : 'Next letter'}
      >
        <Icon size={ICON_SIZE} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />
      </button>
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? index + 1 : index - 1);
  };

  return (
    <div className={[styles.root, tone === 'onPrimary' && styles.onPrimary].filter(Boolean).join(' ')} role="region" aria-roledescription="carousel" aria-labelledby={labelledBy}>
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <div className={styles.track} style={{ '--index': index } as CSSProperties}>
          {slides.map((slide, i) => {
            const offset = Math.abs(i - index);
            const position = offset === 0 ? styles.active : offset === 1 ? styles.beside : styles.away;
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slides.length}: ${slide.name}`}
                aria-hidden={offset !== 0 || undefined}
                className={`${styles.slide} ${position}`}
                // Mouse shortcut only; keyboard and screen reader users have the option row and buttons.
                onClick={offset === 1 ? () => go(i) : undefined}
              >
                <div className={styles.sheet} data-sheet="">
                  {slide.content}
                </div>
                {/* Stops the glide where it is; playing again starts from the top. */}
                {offset === 0 && canAnimate && (
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={() => setStoppedAt(stopped ? null : index)}
                    aria-label={stopped ? 'Play the letter preview from the top' : 'Stop the letter preview moving'}
                  >
                    {stopped ? (
                      <Play size={16} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />
                    ) : (
                      <Pause size={16} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {navButton('previous', styles.besidePrevious)}
        {navButton('next', styles.besideNext)}
      </div>

      <div className={styles.picker}>
        {navButton('previous', styles.withOptions)}
        <div ref={optionsRef} role="radiogroup" aria-label="Letter type" className={styles.options}>
          {slides.map((slide, i) => (
            <label
              key={slide.id}
              className={[styles.option, i === index && styles.selected].filter(Boolean).join(' ')}
            >
              <input
                type="radio"
                name={groupName}
                value={slide.id}
                checked={i === index}
                onChange={() => go(i)}
                className={styles.input}
              />
              {slide.label}
              {slide.recommended && <span className="visually-hidden"> (recommended)</span>}
            </label>
          ))}
        </div>
        {navButton('next', styles.withOptions)}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {`Letter ${index + 1} of ${slides.length}: ${current.name}.`}
      </p>
    </div>
  );
}
