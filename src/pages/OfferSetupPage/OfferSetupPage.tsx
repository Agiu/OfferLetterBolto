import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftRight, Check } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { FlowHeader } from '../../components/FlowHeader/FlowHeader';
import { measureBlue, type FlowTransitionState } from '../../components/FlowHeader/transition';
import { InfoTip } from '../../components/InfoTip/InfoTip';
import { LetterPreview } from '../../components/LetterPreview/LetterPreview';
import { useOffers } from '../../data/OffersContext';
import { SECTION_OF, SETUP_SECTIONS, type SetupSectionId } from '../../data/offerSections';

/**
 * The sections in the order they come down the page: the letter's body, its
 * sign-off, then the hire setup panel under it. (The title and the From line sit above the body,
 * but they repeat details owned by the terms and sender sections, so they don't reorder it.)
 */
const BAR_SECTIONS = (['candidate', 'employment', 'compensation', 'terms', 'sender', 'hire-setup'] as const).map(
  (id) => SETUP_SECTIONS.find((s) => s.id === id)!,
);
import { OFFER_PHASES } from '../../data/offerSteps';
import type { HireSetup, Offer } from '../../data/types';
import { formatLongDate, todayIso } from '../../lib/format';
import { buildLetter, type FieldKey, type LetterField } from '../../lib/letter';
import { tokens } from '../../theme/tokens';
import type { OffersPageState } from '../OffersPage/OffersPage';
import { draftFromOffer, restorePatch, toPatch, type Draft } from './draft';
import { LetterFieldInput, MISSING_HINT_ID, SelectWrap } from './LetterFieldInput';
import styles from './OfferSetupPage.module.css';

/** Wait this long after the last keystroke before saving. */
const AUTOSAVE_DELAY = 800;

const phases = (onPickTemplate: () => void) =>
  OFFER_PHASES.map((step, index) => ({
    ...step,
    status: index === 0 ? ('done' as const) : index === 1 ? ('current' as const) : ('upcoming' as const),
    onSelect: index === 0 ? onPickTemplate : undefined,
  }));

const FLSA_INFO =
  'Fair Labor Standards Act status. Exempt employees are salaried and don’t get overtime; non-exempt employees are paid overtime for hours over 40 a week.';

type SaveState = 'saved' | 'saving' | 'error';

/** A field's dot in the margin, in px from the sheet's top-left (its centre). */
interface FieldDot {
  key: string;
  top: number;
  left: number;
  filled: boolean;
}

/** Space between the letter and the nearest dot, the dot's size, and dot-to-dot on one line. */
const DOT_GAP = 28;
const DOT_SIZE = 10;
const DOT_SPACING = 16;

export function OfferSetupPage() {
  const { offerId } = useParams();
  const { load, offers } = useOffers();

  if (load.status === 'loading') return null;
  const offer = offers.find((o) => o.id === offerId);
  // Only offers that haven't gone out yet can be set up.
  if (!offer || (offer.status !== 'draft' && offer.status !== 'ready')) return <Navigate to="/" replace />;

  return <OfferSetup offer={offer} />;
}

/**
 * Step 2, "Set up letter" (Figma 2045:214, 2045:322): the letter itself is the form. Every
 * detail is filled in where it appears; a bar floating over the letter walks through the five
 * sections and, on the last, offers Review & send.
 */
function OfferSetup({ offer }: { offer: Offer }) {
  const { updateOffer, templates, letterStyles } = useOffers();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const templateId = offer.templateId ?? 'custom';
  const contractor = templateId === 'contractor';

  // The letter on screen is the source of truth; the database follows it (autosave).
  const [draft, setDraft] = useState<Draft>(() => draftFromOffer(offer));
  // For sentences about the candidate ("Invite Alex to Bolto"); "them" until a name is filled in.
  const firstName = draft.recipient.firstName.trim() || 'them';
  /** The first detail still to fill in, reading the page top to bottom. None: everything's filled in. */
  // Per section, how many of its details are on the page and how many are filled in.
  const [progress, setProgress] = useState<Record<string, { total: number; filled: number }>>({});
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [notice, setNotice] = useState<string | null>(null);
  const latest = useRef(draft);
  const dirty = useRef(false);
  const timer = useRef<number>();
  /** The offer as it was when the page opened, for "Don't save". */
  const [opened] = useState(offer);
  const editedThisVisit = useRef(false);
  /** The save on its way to the database, if any. */
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  const [askToSave, setAskToSave] = useState(false);
  const [leaving, setLeaving] = useState<'save' | 'discard' | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const styleOption = templateId === 'custom' ? undefined : letterStyles.find((s) => s.id === offer.letterStyle);
  const letterName = template
    ? `${template.label} ${templateId === 'custom' ? '' : `${template.kind.toLowerCase()} `}letter`
    : 'Letter';
  // Follows the name as it's edited in the To line.
  const recipientName =
    [draft.recipient.firstName.trim(), draft.recipient.lastName.trim()].filter(Boolean).join(' ') ||
    offer.candidate.name;

  // Arriving from picking a template: the blue shrinks from where it was into the bar and the
  // letter rises into place. Read once, so later renders don't replay it.
  const location = useLocation();
  const [blueFrom] = useState(() => (location.state as FlowTransitionState | null)?.blueFrom);
  useLayoutEffect(() => {
    if (blueFrom !== undefined) window.scrollTo(0, 0);
  }, [blueFrom]);

  useEffect(() => headingRef.current?.focus({ preventScroll: blueFrom !== undefined }), [blueFrom]);

  // On a phone the keyboard covers the lower half of the screen: bring the field being edited up
  // to the middle of what's left. Waits for the keyboard to finish opening, then re-centres.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const phone = window.matchMedia('(max-width: 720px)');
    const timers: number[] = [];
    const onFocus = (event: FocusEvent) => {
      const field = event.target as HTMLElement;
      if (!phone.matches || !field.matches('input, select, textarea')) return;
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const bring = () => field.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
      timers.forEach(window.clearTimeout);
      timers.length = 0;
      timers.push(window.setTimeout(bring, 50), window.setTimeout(bring, 350));
    };
    sheet.addEventListener('focusin', onFocus);
    return () => {
      sheet.removeEventListener('focusin', onFocus);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  // A white fade across the bottom of the window says "there's more below"; it goes once you
  // reach the end of the page.
  const [moreBelow, setMoreBelow] = useState(true);
  useEffect(() => {
    const update = () =>
      setMoreBelow(window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  const letter = useMemo(
    () => buildLetter(draft.recipient, draft, templateId, offer.letterStyle ?? 'standard', { editing: true }),
    [draft, templateId, offer.letterStyle],
  );

  // Missing details: the gaps in the letter, the title (its subject line), and FLSA status, which
  // every employee needs for payroll even when the letter doesn't mention it.
  const missingKeys = useMemo(() => {
    const keys = new Set(letter.missingFields.flatMap((f) => (f.key ? [f.key] : [])));
    if (draft.hireSetup?.payrollType !== 'Contractor' && !draft.hireSetup?.flsa) keys.add('flsa');
    // The title is the letter's subject line, outside its body, so it's checked here.
    if (!draft.title?.trim()) keys.add('title');
    return keys;
  }, [letter, draft.hireSetup, draft.title]);

  const missingIn = (section: SetupSectionId) => [...missingKeys].filter((k) => SECTION_OF[k] === section).length;

  // Where each field's dot goes: in the margin left of the letter, level with the field. Fields
  // that share a line get dots side by side, in the same order. Measured from the page, so it
  // follows wrapping, resizing and the letter changing.
  const [fieldDots, setFieldDots] = useState<FieldDot[]>([]);
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const measure = () => {
      const box = sheet.getBoundingClientRect();
      const originX = box.left + sheet.clientLeft;
      const originY = box.top + sheet.clientTop;
      const column = sheet.querySelector<HTMLElement>(`.${styles.letter}`);
      if (!column) return;
      const columnLeft = column.getBoundingClientRect().left - originX;
      // Too little margin (phones): the dot sits in the middle of the gutter.
      const gap = Math.min(DOT_GAP, columnLeft / 2);
      // How many dots fit side by side in the margin. Where a line has more fields than that,
      // it shares one dot, green once every field on the line is filled.
      const fit = Math.max(1, Math.floor((columnLeft - gap - DOT_SIZE / 2) / DOT_SPACING) + 1);

      const rows: { y: number; dots: FieldDot[] }[] = [];
      // A detail can appear more than once (FLSA status is in the letter and in hire setup).
      const seen = new Map<string, number>();
      sheet.querySelectorAll<HTMLElement>('[data-field-key]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height === 0) return;
        const fieldKey = el.dataset.fieldKey!;
        const n = (seen.get(fieldKey) ?? 0) + 1;
        seen.set(fieldKey, n);
        const y = r.top - originY + r.height / 2;
        let row = rows.find((candidate) => Math.abs(candidate.y - y) < r.height / 2);
        if (!row) rows.push((row = { y, dots: [] }));
        row.dots.push({ key: n > 1 ? `${fieldKey}#${n}` : fieldKey, top: row.y, left: 0, filled: !el.dataset.missing });
      });
      const next = rows.flatMap(({ dots }) => {
        const line =
          dots.length <= fit
            ? dots
            : [{ ...dots[0], key: dots.map((d) => d.key).join('+'), filled: dots.every((d) => d.filled) }];
        return line.map((dot, i) => ({ ...dot, left: columnLeft - gap - (line.length - 1 - i) * DOT_SPACING }));
      });
      setFieldDots((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [draft, letter, missingKeys]);

  // How far along each section is, for the bar's progress. Measured from the page, so it only
  // counts details this letter actually has.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    // Each detail counts once, even where it appears twice (FLSA status).
    const seen = new Set<string>();
    const next: Record<string, { total: number; filled: number }> = {};
    sheet?.querySelectorAll<HTMLElement>('[data-field-key]').forEach((el) => {
      const key = el.dataset.fieldKey as FieldKey;
      if (seen.has(key)) return;
      seen.add(key);
      const entry = (next[SECTION_OF[key]] ??= { total: 0, filled: 0 });
      entry.total += 1;
      if (!missingKeys.has(key)) entry.filled += 1;
    });
    setProgress((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, [draft, letter, missingKeys]);

  const allDone = missingKeys.size === 0;
  // Where you are: the first section, in page order, with something still to fill in. Once
  // everything is filled in, it's on the last.
  const firstOpen = BAR_SECTIONS.findIndex((s) => missingIn(s.id) > 0);
  const section = BAR_SECTIONS[firstOpen === -1 ? BAR_SECTIONS.length - 1 : firstOpen];
  // A section with nothing on this letter counts as done.
  // What to tell screen reader users as they fill in: only changes worth hearing.
  const [announcement, setAnnouncement] = useState('');
  // Cleared first, so the same words are heard again when they come up again.
  const announce = (text: string) => {
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(text), 100);
  };
  const doneBefore = useRef<Set<SetupSectionId> | null>(null);
  const doneIds = SETUP_SECTIONS.filter((s) => missingIn(s.id) === 0).map((s) => s.id);
  const doneKey = doneIds.join(',');
  useEffect(() => {
    const now = new Set(doneKey ? (doneKey.split(',') as SetupSectionId[]) : []);
    const before = doneBefore.current;
    doneBefore.current = now;
    if (!before) return; // Nothing to announce on arrival.
    if (now.size === SETUP_SECTIONS.length && before.size < SETUP_SECTIONS.length) {
      announce('Everything’s filled in. Review & send is ready at the bottom of the page.');
      return;
    }
    const finished = SETUP_SECTIONS.find((s) => now.has(s.id) && !before.has(s.id));
    if (finished) announce(`${finished.label}: all filled in.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce only sets state
  }, [doneKey]);

  // Hire setup's FLSA status repeats the letter's, when the letter has one.
  const letterHasFlsa = useMemo(() => JSON.stringify(letter).includes('"key":"flsa"'), [letter]);

  const counts = Object.values(progress);
  const fieldsTotal = counts.reduce((n, p) => n + p.total, 0);
  const fieldsFilled = counts.reduce((n, p) => n + p.filled, 0);
  const sectionsDone = SETUP_SECTIONS.filter((s) => missingIn(s.id) === 0).length;

  const save = useCallback(
    async (extra: Partial<{ status: Offer['status'] }> = {}) => {
      window.clearTimeout(timer.current);
      dirty.current = false;
      setSaveState('saving');
      try {
        const request = updateOffer(offer.id, { ...toPatch(latest.current), ...extra });
        inFlight.current = request.catch(() => {});
        const saved = await request;
        setSaveState('saved');
        return saved;
      } catch (error) {
        dirty.current = true;
        setSaveState('error');
        throw error;
      }
    },
    [offer.id, updateOffer],
  );

  const change = (next: Draft) => {
    setDraft(next);
    setNotice(null);
    latest.current = next;
    dirty.current = true;
    editedThisVisit.current = true;
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save().catch(() => {}), AUTOSAVE_DELAY);
  };

  // Leaving with unsaved edits (back link, browser back): save them on the way out.
  useEffect(
    () => () => {
      if (!dirty.current) return;
      window.clearTimeout(timer.current);
      void updateOffer(offer.id, toPatch(latest.current)).catch(() => {});
    },
    [offer.id, updateOffer],
  );

  /** Puts the cursor in a section's first gap, or its first detail when it's all filled in. */
  const goToSection = (id: SetupSectionId) => {
    const sheet = sheetRef.current;
    const target =
      sheet?.querySelector<HTMLElement>(`[data-section="${id}"][data-field-key][data-missing]`) ??
      sheet?.querySelector<HTMLElement>(`[data-section="${id}"][data-field-key]`);
    if (!target) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
  };

  /** Puts the cursor in the first gap of the section the bar is on. */
  const goToFirstMissing = () => goToSection(section.id);

  // Picking another template. Edits are saved as you type, so "save" is really "keep the
  // changes made since opening the page"; "don't save" puts the letter back as it was.
  const toTemplate = () =>
    navigate(`/offers/${offer.id}/template`, { state: { reveal: true } satisfies FlowTransitionState });
  const onPickTemplate = () => {
    if (editedThisVisit.current) setAskToSave(true);
    else toTemplate();
  };

  const onSaveAndPick = async () => {
    setLeaving('save');
    try {
      await save();
      toTemplate();
    } catch {
      setLeaving(null);
      setAskToSave(false);
      setNotice('Couldn’t save. Check your connection and try again.');
    }
  };

  const onDiscardAndPick = async () => {
    setLeaving('discard');
    window.clearTimeout(timer.current);
    dirty.current = false;
    await inFlight.current;
    try {
      await updateOffer(offer.id, restorePatch(opened));
      toTemplate();
    } catch {
      setLeaving(null);
      setAskToSave(false);
      setNotice('Couldn’t undo your changes. Check your connection and try again.');
    }
  };

  const onSaveDraft = async () => {
    try {
      await save();
      navigate('/', {
        state: { createdOfferId: offer.id, announcement: `Draft saved for ${offer.candidate.name}.` } satisfies OffersPageState,
      });
    } catch {
      setNotice('Couldn’t save. Check your connection and try again.');
    }
  };

  // A complete letter is marked ready to send and goes on to the review. Anything missing first
  // takes you to it, like a forgotten-attachment check.
  const onReview = async () => {
    if (missingKeys.size > 0) {
      setNotice(
        missingKeys.size === 1
          ? 'One detail is still missing. It’s highlighted on the letter.'
          : `${missingKeys.size} details are still missing. They’re highlighted on the letter.`,
      );
      goToFirstMissing();
      return;
    }
    try {
      await save({ status: 'ready' });
      // On to the review: the blue grows from the header band to fill the screen.
      navigate(`/offers/${offer.id}/review`, {
        state: { blueFrom: measureBlue() } satisfies FlowTransitionState,
      });
    } catch {
      setNotice('Couldn’t save. Check your connection and try again.');
    }
  };

  // The letter counts each detail as it comes up; the second time is a repeat.
  const renderField = (field: LetterField, occurrence = 1) => {
    if (!field.key) return null;
    const repeat = occurrence > 1;
    return (
      <LetterFieldInput
        fieldKey={field.key}
        label={field.field}
        draft={draft}
        templateId={templateId}
        onChange={change}
        missing={missingKeys.has(field.key)}
        repeat={repeat}
      />
    );
  };

  const setHire = (patch: Partial<HireSetup>) => change({ ...draft, hireSetup: { ...draft.hireSetup!, ...patch } });
  const sectionMissing = missingIn(section.id);

  return (
    <div className={styles.page}>
      <FlowHeader steps={phases(onPickTemplate)} morphFrom={blueFrom}>
        <div className={styles.heroColumn}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.heroTitle}>
            Set up the offer letter
          </h1>
          <p className={styles.heroDescription}>Edit each field to prepare a send off.</p>
        </div>
      </FlowHeader>

      <main className={styles.main}>
        <div ref={sheetRef} className={[styles.sheet, blueFrom !== undefined && styles.arrive].filter(Boolean).join(' ')}>
          {/* A dot beside every detail to fill in, level with it: a ring until it's filled, then green. */}
          <div className={styles.fieldDots} aria-hidden="true">
            {fieldDots.map((dot) => (
              <span
                key={dot.key}
                className={[styles.fieldDot, dot.filled && styles.fieldDotFilled].filter(Boolean).join(' ')}
                style={{ top: dot.top, left: dot.left }}
              />
            ))}
          </div>

          {/* Figma 2060:444: a blue strip across the top of the letter saying which letter this
              is and who it's for, with the way back to pick another template. */}
          <div className={styles.letterType}>
            <p className={styles.letterName}>
              {styleOption ? `${styleOption.label} ${letterName}` : letterName} for
              <br />
              {recipientName}
            </p>
            <button type="button" className={styles.changeTemplate} onClick={onPickTemplate}>
              <ArrowLeftRight size={16} strokeWidth={tokens.icon.strokeWidth} aria-hidden="true" />
              Change template
            </button>
          </div>

          <section aria-label={`Offer letter for ${recipientName}`}>
            {/* Missing fields point here (aria-describedby): "Still to fill in." */}
            <p id={MISSING_HINT_ID} hidden>
              Still to fill in.
            </p>
            <LetterPreview
              letter={letter}
              title={draft.title ?? ''}
              dated={formatLongDate(todayIso())}
              renderField={renderField}
              className={styles.letter}
            />
          </section>

          {/* Payroll details Bolto needs but the candidate never sees. */}
          <section
            className={styles.hire}
            aria-labelledby="hire-setup-title"
          >
            <div className={styles.hireHead}>
              <h2 id="hire-setup-title" className={styles.hireTitle}>
                Hire setup
              </h2>
              <p className={styles.hireNote}>
                Not part of the letter. Bolto uses this to set {firstName} up once they sign.
              </p>
            </div>

            <div className={styles.hireGrid}>
              <label className={styles.hireRow}>
                <span className={styles.hireLabel}>Payroll group</span>
                {contractor ? (
                  <span className={styles.hireValue}>Contractor</span>
                ) : (
                  <SelectWrap>
                    <select
                      data-section="hire-setup"
                      value={draft.hireSetup?.payrollType}
                      onChange={(e) => setHire({ payrollType: e.target.value as HireSetup['payrollType'] })}
                      className={`${styles.field} ${styles.select}`}
                    >
                      <option>US Salaried</option>
                      <option>US Hourly</option>
                    </select>
                  </SelectWrap>
                )}
              </label>

              {!contractor && (
                <div className={styles.hireRow}>
                  <span className={styles.hireLabel}>
                    FLSA status
                    <InfoTip label="About FLSA status">{FLSA_INFO}</InfoTip>
                  </span>
                  {renderField({ field: 'Exempt or non-exempt', key: 'flsa' }, letterHasFlsa ? 2 : 1)}
                </div>
              )}

              {!contractor && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    data-section="hire-setup"
                    checked={draft.hireSetup?.i9Required ?? true}
                    onChange={(e) => setHire({ i9Required: e.target.checked })}
                  />
                  Collect Form I-9 before their first day
                </label>
              )}

              <label className={styles.check}>
                <input
                  type="checkbox"
                  data-section="hire-setup"
                  checked={draft.hireSetup?.autoInvite ?? true}
                  onChange={(e) => setHire({ autoInvite: e.target.checked })}
                />
                Invite {firstName} to Bolto automatically once they sign
              </label>
            </div>
          </section>

          {/* Floating progress bar (Figma 2045:214): where you are, what's left, what's next. */}
          <div className={[styles.bar, allDone && styles.barReady].filter(Boolean).join(' ')} role="group" aria-label="Offer sections">
            <p className={styles.counter} aria-hidden="true">
              {sectionsDone}/{SETUP_SECTIONS.length}
            </p>
            <div className={styles.barText}>
              <p className={styles.sectionName}>
                <span className="visually-hidden">
                  {sectionsDone} of {SETUP_SECTIONS.length} sections done. Next:{' '}
                </span>
                {section.label}
              </p>
              <p className={styles.barMeta}>
                {notice ?? (
                  <>
                    {sectionMissing === 0 ? (
                      <span className={styles.done}>
                        <Check size={14} strokeWidth={2} aria-hidden="true" />
                        All filled in
                      </span>
                    ) : (
                      <span>{sectionMissing} to fill in</span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved'}</span>
                  </>
                )}
              </p>
            </div>

            {/* Screen readers hear progress when it matters: a section done, everything done,
                or something going wrong. */}
            <p className="visually-hidden" role="status">
              {notice ?? announcement}
            </p>

            {/* One bar for the whole letter, filling Bolto blue as details are filled in. */}
            <div
              className={styles.track}
              role="progressbar"
              aria-label="Details filled in"
              aria-valuemin={0}
              aria-valuemax={fieldsTotal}
              aria-valuenow={fieldsFilled}
              aria-valuetext={`${fieldsFilled} of ${fieldsTotal} details filled in`}
            >
              <span className={styles.trackFill} style={{ width: `${fieldsTotal ? (fieldsFilled / fieldsTotal) * 100 : 0}%` }} />
            </div>

            <div className={styles.barActions}>
              <Button variant="secondary" onClick={onSaveDraft}>
                Save draft
              </Button>
              {allDone && <Button onClick={onReview}>Review &amp; send</Button>}
            </div>
          </div>
        </div>
      </main>

      <div className={[styles.fade, moreBelow && styles.fadeOn].filter(Boolean).join(' ')} aria-hidden="true" />

      <Dialog
        open={askToSave}
        title="Save your changes before switching templates?"
        onClose={() => leaving === null && setAskToSave(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAskToSave(false)} disabled={leaving !== null}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={onDiscardAndPick} disabled={leaving !== null}>
              {leaving === 'discard' ? 'Undoing…' : 'Don’t save'}
            </Button>
            <Button onClick={onSaveAndPick} disabled={leaving !== null}>
              {leaving === 'save' ? 'Saving…' : 'Save and continue'}
            </Button>
          </>
        }
      >
        <p>
          You’ve changed this letter since you opened it. Save to keep your changes; when you pick a template you’ll
          see which of them carry over.
        </p>
      </Dialog>
    </div>
  );
}
