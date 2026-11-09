import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Dialog } from '../../components/Dialog/Dialog';
import { Button } from '../../components/Button/Button';
import { FlowHeader } from '../../components/FlowHeader/FlowHeader';
import type { FlowTransitionState } from '../../components/FlowHeader/transition';
import { LetterPreview } from '../../components/LetterPreview/LetterPreview';
import { useOffers } from '../../data/OffersContext';
import { OFFER_PHASES } from '../../data/offerSteps';
import type { Offer } from '../../data/types';
import { formatLongDate, todayIso } from '../../lib/format';
import { buildLetter, recipientOf } from '../../lib/letter';
import { tokens } from '../../theme/tokens';
import type { OffersPageState } from '../OffersPage/OffersPage';
import styles from './ReviewPage.module.css';

const ICON_SIZE = parseInt(tokens.icon.size.sm, 10);

export function ReviewPage() {
  const { offerId } = useParams();
  const { load, offers } = useOffers();
  const openedRef = useRef(false);

  if (load.status === 'loading') return null;
  const offer = offers.find((o) => o.id === offerId);
  // Only offers that haven't gone out yet can be reviewed.
  // Judged on arrival only: sending changes the status, and the page stays up to say so.
  if (!offer || (!openedRef.current && offer.status !== 'draft' && offer.status !== 'ready')) {
    return <Navigate to="/" replace />;
  }
  openedRef.current = true;

  return <Review offer={offer} />;
}

/**
 * Step 3, "Review letter" (Figma 2050:421): the blue fills the screen and the letter that will
 * reach the candidate is shown as it'll be sent. Beside it, everything entered with what it is;
 * under it, an optional personal note and Send. "Back to editing" sits at the left of that panel.
 */
function Review({ offer }: { offer: Offer }) {
  const { updateOffer } = useOffers();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState(offer.personalNote ?? '');
  const [phase, setPhase] = useState<'review' | 'sending' | 'sent'>('review');
  const sending = phase === 'sending';
  // Once it's sent, focus moves to the dialog's one button, so keyboard and screen reader users
  // land on the way out (the dialog had nothing focusable while sending).
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (phase === 'sent') doneRef.current?.focus();
  }, [phase]);
  const [error, setError] = useState<string | null>(null);

  const templateId = offer.templateId ?? 'custom';
  const firstName = offer.candidate.name.split(' ')[0];

  // Arriving from the set-up page: the blue grows from the header band to the whole screen and
  // the letter rises into place. Read once, so later renders don't replay it.
  const location = useLocation();
  const [blueFrom] = useState(() => (location.state as FlowTransitionState | null)?.blueFrom);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

  const letter = useMemo(
    () => buildLetter(recipientOf(offer.candidate), offer, templateId, offer.letterStyle ?? 'standard'),
    [offer, templateId],
  );
  // Nothing goes out with gaps in it: back to the set-up page, which highlights them.
  const complete =
    letter.missing === 0 &&
    !!offer.title?.trim() &&
    (offer.hireSetup?.payrollType === 'Contractor' || !!offer.hireSetup?.flsa);
  if (!complete) return <Navigate to={`/offers/${offer.id}/setup`} replace />;

  /** Back to the set-up page: the blue shrinks back into the header band. */
  const toSetup = () => {
    const trimmed = note.trim();
    // Keep the note for when they come back (best effort).
    if (trimmed !== (offer.personalNote ?? '')) {
      void updateOffer(offer.id, { personalNote: trimmed || null }).catch(() => {});
    }
    navigate(`/offers/${offer.id}/setup`, {
      state: { blueFrom: window.innerHeight } satisfies FlowTransitionState,
    });
  };

  const toTemplate = () =>
    navigate(`/offers/${offer.id}/template`, { state: { reveal: true } satisfies FlowTransitionState });

  const phases = OFFER_PHASES.map((step, index) => ({
    ...step,
    status:
      phase === 'sent' || index < 2
        ? ('done' as const)
        : index === 2 && phase === 'review'
          ? ('current' as const)
          : index === 3 && phase === 'sending'
            ? ('current' as const)
            : index === 2
              ? ('done' as const)
              : ('upcoming' as const),
    onSelect: phase !== 'review' ? undefined : index === 0 ? toTemplate : index === 1 ? toSetup : undefined,
  }));

  /** Opens the sending modal and moves the timeline on to "Send offer letter". */
  const send = async () => {
    if (sending) return;
    setPhase('sending');
    setError(null);
    try {
      // Held for a moment so the progress is visible even when the server answers at once.
      await Promise.all([
        updateOffer(offer.id, { personalNote: note.trim() || null, status: 'sent' }),
        new Promise((resolve) => setTimeout(resolve, 1600)),
      ]);
      setPhase('sent');
    } catch {
      setError('Couldn’t send the letter. Check your connection and try again.');
      setPhase('review');
    }
  };

  const backToList = () =>
    navigate('/', {
      state: {
        createdOfferId: offer.id,
        announcement: `Offer letter sent to ${offer.candidate.name}.`,
      } satisfies OffersPageState,
    });

  const arrive = blueFrom !== undefined;

  return (
    <div className={styles.page} style={arrive ? ({ '--grow-from': `${blueFrom}px` } as React.CSSProperties) : undefined}>
      {/* The blue behind everything, growing from the band to the whole screen. */}
      <div className={[styles.blue, arrive && styles.grow].filter(Boolean).join(' ')} aria-hidden="true" />

      <FlowHeader steps={phases} />

      <main className={[styles.main, arrive && styles.arrive].filter(Boolean).join(' ')}>
        <h1 ref={headingRef} tabIndex={-1} className="visually-hidden">
          Review the offer letter for {offer.candidate.name}
        </h1>

        <section className={styles.letterSection} aria-label="The letter, as it will be sent">
          <LetterPreview letter={letter} title={offer.title ?? ''} dated={formatLongDate(todayIso())} className={styles.letter} />
        </section>

        <section className={styles.note} aria-labelledby="note-title">
          <h2 id="note-title" className={styles.noteTitle}>
            Provide {firstName} with a personal note
          </h2>
          <label className="visually-hidden" htmlFor="personal-note">
            Personal note for {firstName} (optional)
          </label>
          <textarea
            id="personal-note"
            className={styles.noteField}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`A few words to welcome ${firstName} (optional)`}
            rows={3}
          />
          <div className={styles.noteActions}>
            <Button
              variant="secondary"
              onClick={toSetup}
              disabled={sending}
              leadingIcon={<ArrowLeft size={ICON_SIZE} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />}
            >
              Back to editing
            </Button>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <Button
              onClick={send}
              disabled={sending}
              trailingIcon={<ArrowRight size={ICON_SIZE} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />}
            >
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </section>
      </main>

      <Dialog
        open={phase !== 'review'}
        title={phase === 'sent' ? `Offer letter sent to ${firstName}` : `Sending to ${firstName}`}
        onClose={phase === 'sent' ? backToList : () => {}}
        actions={
          phase === 'sent' ? (
            <Button ref={doneRef} onClick={backToList}>
              Back to offer letters
            </Button>
          ) : null
        }
      >
        {phase === 'sent' ? (
          <p role="status">{offer.candidate.name} will get the letter at {offer.candidate.email}.</p>
        ) : (
          <div className={styles.sending} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <p>Sending the offer letter…</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
