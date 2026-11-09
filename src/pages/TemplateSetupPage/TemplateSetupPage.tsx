import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { FlowHeader } from '../../components/FlowHeader/FlowHeader';
import { afterLeaving, measureBlue, type FlowTransitionState } from '../../components/FlowHeader/transition';
import { InfoTip } from '../../components/InfoTip/InfoTip';
import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { LetterCarousel, type LetterSlide } from '../../components/LetterCarousel/LetterCarousel';
import { LetterPreview } from '../../components/LetterPreview/LetterPreview';
import { TextField } from '../../components/TextField/TextField';
import { useOffers } from '../../data/OffersContext';
import { OFFER_PHASES } from '../../data/offerSteps';
import { prefillFor } from '../../data/prefill';
import { switchTemplate } from '../../data/switchTemplate';
import type { Candidate, LetterStyle, Offer, TemplateId } from '../../data/types';
import { defaultLetterTitle, formatLongDate, todayIso } from '../../lib/format';
import { buildLetter, recipientOf } from '../../lib/letter';
import { tokens } from '../../theme/tokens';
import { CarryOverSummary } from './CarryOverSummary';
import styles from './TemplateSetupPage.module.css';

const ICON_SIZE = parseInt(tokens.icon.size.sm, 10);

/** One carousel slide per letter: each template in each style, and Custom once. */
interface LetterOption {
  templateId: TemplateId;
  style?: LetterStyle;
}

/** A slide plus what the panel under the carousel says about it. */
interface LetterChoice extends LetterSlide {
  /** e.g. "1099 contractor letter". */
  letterName: string;
  styleLabel?: string;
  description: string;
  /** Payroll implications of the template, for the info bubble. */
  info?: string;
  /** Details still to fill in on this letter. */
  missing: number;
  /** The letter the draft is on now (when changing an existing draft's template). */
  current: boolean;
}

const phases = (onSetUp?: () => void) =>
  OFFER_PHASES.map((step, index) => ({
    ...step,
    status: index === 0 ? ('current' as const) : ('upcoming' as const),
    onSelect: index === 1 ? onSetUp : undefined,
  }));

export function TemplateSetupPage() {
  const { candidateId } = useParams();
  const { load, candidates } = useOffers();

  // Opened directly by URL: wait for the database before deciding the candidate doesn't exist.
  if (load.status === 'loading') return null;
  // All candidates, not just those without an offer: saving the offer below takes this
  // candidate out of availableCandidates, which must not bounce the page before it navigates.
  const candidate = candidates.find((c) => c.id === candidateId);
  if (!candidate) return <Navigate to="/" replace />;

  return <TemplateSetupForm candidate={candidate} />;
}

/** The same page for a draft that already exists: pick another letter for it. */
export function ChangeTemplatePage() {
  const { offerId } = useParams();
  const { load, offers, candidates } = useOffers();

  if (load.status === 'loading') return null;
  const offer = offers.find((o) => o.id === offerId);
  if (!offer || (offer.status !== 'draft' && offer.status !== 'ready')) return <Navigate to="/" replace />;
  // What Bolto knows about the role comes from the candidate. Offers keep their own copy of
  // name and email, so a candidate who's since gone just means nothing extra is known.
  const candidate: Candidate = candidates.find((c) => c.email === offer.candidate.email) ?? {
    id: '',
    ...offer.candidate,
    jobTitle: offer.jobTitle,
    prefill: {},
  };

  return <TemplateSetupForm candidate={candidate} offer={offer} />;
}

const sameLetter = (a: LetterOption, b: LetterOption) =>
  a.templateId === b.templateId && (a.templateId === 'custom' || a.style === b.style);

function TemplateSetupForm({ candidate, offer }: { candidate: Candidate; offer?: Offer }) {
  const { createOffer, updateOffer, templates, letterStyles } = useOffers();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const letterHeadingId = useId();

  const recommendedId = candidate.prefill.templateId;
  // Changing an existing draft starts on its current letter and title.
  const currentLetter = useMemo<LetterOption | null>(
    () => (offer ? { templateId: offer.templateId ?? 'custom', style: offer.letterStyle ?? 'standard' } : null),
    [offer],
  );
  const [templateId, setTemplateId] = useState<TemplateId | null>(currentLetter?.templateId ?? recommendedId ?? null);
  const [letterStyle, setLetterStyle] = useState<LetterStyle>(currentLetter?.style ?? 'standard');
  const [title, setTitle] = useState(() => offer?.title ?? defaultLetterTitle(candidate));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  // Coming back from setting up the letter: the blue band unrolls from the bar. Read once, so
  // later renders don't replay it.
  const location = useLocation();
  const [reveal] = useState(() => !!(location.state as FlowTransitionState | null)?.reveal);
  const [leaving, setLeaving] = useState(false);
  /**
   * On to setting up the letter: fade away what's on the blue, then go, taking the blue's
   * height along so the next page can shrink it into its bar.
   */
  const toSetup = async (offerId: string) => {
    setLeaving(true);
    await afterLeaving();
    navigate(`/offers/${offerId}/setup`, { state: { blueFrom: measureBlue() } satisfies FlowTransitionState });
  };
  const backToLetter = offer ? () => void toSetup(offer.id) : undefined;

  // Move focus to the page heading so keyboard and screen reader users land at the top.
  useEffect(() => headingRef.current?.focus(), []);

  const options = useMemo<LetterOption[]>(
    () =>
      templates.flatMap<LetterOption>((t) =>
        t.id === 'custom'
          ? [{ templateId: t.id }]
          : letterStyles.map((s) => ({ templateId: t.id, style: s.id })),
      ),
    [templates, letterStyles],
  );

  const dated = formatLongDate(todayIso());
  const slides = useMemo<LetterChoice[]>(
    () =>
      options.map(({ templateId: id, style }) => {
        const template = templates.find((t) => t.id === id)!;
        const styleOption = letterStyles.find((s) => s.id === style);
        // An existing draft previews with its own details, as they'd carry over to this letter.
        const details = offer
          ? switchTemplate(offer, candidate.prefill, id, style).details
          : { ...prefillFor(candidate.prefill, id), jobTitle: candidate.prefill.jobTitle ?? candidate.jobTitle };
        const current = !!currentLetter && sameLetter(currentLetter, { templateId: id, style });
        const letter = buildLetter(recipientOf(offer?.candidate ?? candidate), details, id, style ?? 'standard');
        const letterName =
          id === 'custom' ? `${template.label} letter` : `${template.label} ${template.kind.toLowerCase()} letter`;
        return {
          id: style ? `${id}-${style}` : id,
          label: styleOption ? `${template.label} · ${styleOption.label}` : template.label,
          name: (styleOption ? `${letterName} · ${styleOption.label}` : letterName) + (current ? ' (current letter)' : ''),
          letterName,
          styleLabel: styleOption?.label,
          description: styleOption?.description ?? 'A blank letter in your own words, written on the next step.',
          info: template.info,
          recommended: id === recommendedId,
          missing: letter.missing,
          current,
          content: <LetterPreview letter={letter} title={title} dated={dated} compact example />,
        };
      }),
    [options, templates, letterStyles, candidate, offer, currentLetter, recommendedId, title, dated],
  );

  const slideIndex = options.findIndex(
    (o) => o.templateId === templateId && (o.templateId === 'custom' || o.style === letterStyle),
  );

  // The letter on screen is the selection, so there's always one.
  useEffect(() => {
    if (templateId === null && options.length > 0) setTemplateId(options[0].templateId);
  }, [templateId, options]);

  const onSlideChange = (index: number) => {
    const { templateId: id, style } = options[index];
    setTemplateId(id);
    if (style) setLetterStyle(style);
  };

  const isCustom = templateId === 'custom';
  const titleMissing = title.trim() === '';
  const canContinue = templateId !== null && !titleMissing && !saving;
  const picked: LetterOption | null = templateId && { templateId, style: isCustom ? undefined : letterStyle };
  const switching = !!currentLetter && !!picked && !sameLetter(currentLetter, picked);
  const carryOver =
    offer && picked && switching ? switchTemplate(offer, candidate.prefill, picked.templateId, picked.style) : null;

  /** Existing draft: save the new letter (and title), then back to setting it up. */
  const saveChange = async () => {
    if (!offer || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateOffer(offer.id, {
        ...carryOver?.patch,
        title: title.trim(),
        // A new letter can have new gaps, so it isn't ready to send any more.
        ...(carryOver && { status: 'draft' as const }),
      });
      setConfirmSwitch(false);
      await toSetup(offer.id);
    } catch (error) {
      setConfirmSwitch(false);
      setSaveError(`Couldn’t save the change. ${(error as Error).message}`);
      setSaving(false);
    }
  };

  const onContinue = async () => {
    if (!templateId || titleMissing || saving) return;
    if (offer) {
      // Another letter: first show what carries over from the saved draft.
      if (switching) setConfirmSwitch(true);
      else await saveChange();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const offer = await createOffer(candidate, {
        templateId,
        letterStyle: isCustom ? undefined : letterStyle,
        title: title.trim(),
      });
      await toSetup(offer.id);
    } catch (error) {
      setSaveError(`Couldn’t save the offer. ${(error as Error).message}`);
      setSaving(false);
    }
  };

  const titleProps = {
    required: true,
    value: title,
    onChange: setTitle,
    error: titleMissing ? 'Add a title for the letter.' : undefined,
  };

  const choice = slides[Math.max(slideIndex, 0)];
  const heading = (highlight: string) => (
    <>
      {offer ? 'Pick a letter for ' : 'Create an offer for '}
      <span className={highlight}>{candidate.name}</span>,{' '}
      <span className={`${highlight} ${styles.position}`}>{candidate.jobTitle}</span>
    </>
  );

  // Reads as a sentence: "Switch to the standard 1099 contractor letter?", "Switch to a custom letter?"
  const switchTitle = !choice
    ? 'Switch letter?'
    : choice.styleLabel
      ? `Switch to the ${choice.styleLabel.toLowerCase()} ${choice.letterName}?`
      : `Switch to a ${choice.letterName.toLowerCase()}?`;

  const switchDialog = (
    <Dialog
      open={confirmSwitch && !!carryOver}
      title={switchTitle}
      onClose={() => setConfirmSwitch(false)}
      actions={
        <>
          <Button variant="secondary" onClick={() => setConfirmSwitch(false)}>
            Keep current letter
          </Button>
          <Button onClick={saveChange} disabled={saving}>
            {saving ? 'Switching…' : 'Switch letter'}
          </Button>
        </>
      }
    >
      {carryOver && <CarryOverSummary items={carryOver.items} sameTemplate={currentLetter?.templateId === templateId} />}
    </Dialog>
  );

  const footer = (
    <footer className={styles.footer}>
      <div className={styles.actions}>
        {saveError && (
          <p role="alert" className={styles.saveError}>
            {saveError}
          </p>
        )}
        <Button variant="secondary" onClick={backToLetter ?? (() => navigate('/'))} className={styles.secondaryAction}>
          {offer ? 'Back to letter' : 'Cancel'}
        </Button>
        <Button
          disabled={!canContinue}
          onClick={onContinue}
          trailingIcon={<ArrowRight size={ICON_SIZE} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />}
        >
          {saving ? 'Saving…' : switching ? 'Switch letter' : 'Continue'}
        </Button>
      </div>
    </footer>
  );

  // After the wireframe (Figma 2043:299): blue band with logo, four phases and the title; three
  // letters; a panel naming the letter in the middle with its title field. Added back around it:
  // the way back to the list, the option row and arrows, the payroll info bubble, and Cancel /
  // Continue.
  return (
    <div className={styles.page}>
      <FlowHeader steps={phases(backToLetter)} reveal={reveal} leaving={leaving}>
        <div className={styles.heroColumn}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.heroTitle}>
            {heading(styles.underlined)}
          </h1>
        </div>
        <h2 id={letterHeadingId} className="visually-hidden">
          Choose a letter
        </h2>
        {choice && (
          <LetterCarousel
            slides={slides}
            index={Math.max(slideIndex, 0)}
            onChange={onSlideChange}
            labelledBy={letterHeadingId}
            tone="onPrimary"
          />
        )}
      </FlowHeader>

      <main className={styles.previewMain}>
        {choice && (
          <>
            <section className={styles.panel} aria-label="Selected letter">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{choice.letterName}</h2>
                {choice.current && <span className={styles.tag}>Current letter</span>}
                {choice.info && (
                  <InfoTip label={`About ${choice.letterName}`} className={styles.panelInfo}>
                    {choice.info}
                  </InfoTip>
                )}
              </div>
              <TextField label="Title" {...titleProps} className={styles.panelField} />
            </section>
          </>
        )}
      </main>

      {footer}
      {switchDialog}
    </div>
  );
}
