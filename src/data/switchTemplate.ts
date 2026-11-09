import { formatEmployment, formatLongDate, formatMoney, formatPay } from '../lib/format';
import { describeWorkLocation } from '../lib/workLocation';
import type { OfferPatch } from './api';
import { prefillFor } from './prefill';
import type { Employment, HireSetup, LetterStyle, Offer, OfferDetails, SigningBonus, TemplateId } from './types';

/**
 * What happens to a saved draft's details when its letter changes to another template.
 *
 * - Details every letter uses (title, role, department, dates, manager, location, sender) always
 *   carry over.
 * - Equity, like the signing bonus, isn't on contractor letters.
 * - Pay, bonus, employment type and payroll setup belong to one side of the contractor /
 *   employee line. They carry over within a side and into Custom (which takes either); across
 *   the line they're swapped for what Bolto knows about the role for that template, or left to
 *   fill in when Bolto doesn't know.
 */

/** kept as is · replaced with Bolto's value · cleared, to fill in again · dropped: not on this letter. */
export type CarryOutcome = 'kept' | 'replaced' | 'cleared' | 'dropped';

export interface CarryItem {
  id: string;
  label: string;
  outcome: CarryOutcome;
  /** The draft's value. */
  before: string;
  /** The value on the new letter ('replaced' only). */
  after?: string;
}

export interface TemplateSwitch {
  /** The draft's details as they'll be on the new letter. */
  details: Partial<OfferDetails> & { jobTitle: string };
  /** Only details the draft has; empty ones have nothing to carry. */
  items: CarryItem[];
  /** Saves the switch. */
  patch: OfferPatch;
}

type Side = 'contractor' | 'employee';

function sideOf(templateId: TemplateId, d: Partial<OfferDetails>): Side {
  if (templateId === 'contractor') return 'contractor';
  if (templateId === 'w2') return 'employee';
  return d.employment?.type === 'contractor' || d.hireSetup?.payrollType === 'Contractor' ? 'contractor' : 'employee';
}

const employmentFits = (to: TemplateId, employment: Employment) =>
  to === 'custom' || (to === 'contractor') === (employment.type === 'contractor');

function describeEmployment(employment: Employment) {
  if (employment.type !== 'contractor') return formatEmployment(employment);
  return employment.endsOn ? `Contract ends ${formatLongDate(employment.endsOn)}` : 'Contractor';
}

function describeHireSetup(hire: HireSetup) {
  const parts: string[] = [hire.payrollType];
  if (hire.flsa) parts.push(hire.flsa === 'exempt' ? 'exempt' : 'non-exempt');
  if (hire.payrollType !== 'Contractor') parts.push(hire.i9Required ? 'I-9' : 'no I-9');
  return parts.join(', ');
}

/** Payroll setup for a letter when nothing fitting is known yet. */
function defaultHireSetup(to: TemplateId, d: Partial<OfferDetails>, autoInvite: boolean): HireSetup {
  const contractor = to === 'contractor';
  return {
    payrollType: contractor ? 'Contractor' : d.pay?.basis === 'hourly' ? 'US Hourly' : 'US Salaried',
    i9Required: !contractor,
    autoInvite,
  };
}

export function switchTemplate(
  offer: Offer,
  /** What Bolto knows about the role (the candidate's prefill). */
  known: Partial<OfferDetails>,
  to: TemplateId,
  letterStyle: LetterStyle | undefined,
): TemplateSwitch {
  const from = offer.templateId ?? 'custom';
  const bolto = prefillFor(known, to);
  const sameSide = to === 'custom' || sideOf(from, offer) === (to === 'contractor' ? 'contractor' : 'employee');
  const items: CarryItem[] = [];

  const shared = (id: string, label: string, value: string | undefined) => {
    if (value) items.push({ id, label, outcome: 'kept', before: value });
  };
  shared('title', 'Letter title', offer.title);
  shared('jobTitle', 'Job title', offer.jobTitle);
  shared('department', 'Department', offer.department);
  shared('startDate', 'Start date', offer.startDate && formatLongDate(offer.startDate));
  shared('reportsTo', 'Reports to', offer.reportsTo);
  shared('workLocation', 'Work location', describeWorkLocation(offer));
  shared('expiresOn', 'Offer expires', offer.expiresOn && formatLongDate(offer.expiresOn));
  shared(
    'sender',
    'Sender',
    offer.sender && [offer.sender.name, offer.sender.title, offer.sender.email ?? ''].filter((s) => s.trim()).join(', '),
  );

  /** A side-specific detail: kept if it fits, else Bolto's value for the new letter, else cleared. */
  function sided<T>(
    id: string,
    label: string,
    value: T | undefined,
    fits: boolean,
    fallback: T | undefined,
    describe: (v: T) => string,
  ): T | undefined {
    if (value === undefined || value === null) return value;
    if (fits) {
      items.push({ id, label, outcome: 'kept', before: describe(value) });
      return value;
    }
    if (fallback !== undefined && fallback !== null) {
      items.push({ id, label, outcome: 'replaced', before: describe(value), after: describe(fallback) });
      return fallback;
    }
    items.push({ id, label, outcome: 'cleared', before: describe(value) });
    return undefined;
  }

  const employment = sided(
    'employment',
    'Employment',
    offer.employment,
    !!offer.employment && employmentFits(to, offer.employment),
    bolto.employment,
    describeEmployment,
  );
  const pay = sided('pay', 'Pay', offer.pay, sameSide, bolto.pay, formatPay);
  let signingBonus: SigningBonus | null | undefined;
  if (to === 'contractor' && offer.signingBonus) {
    // Contractor letters have no signing bonus.
    items.push({ id: 'signingBonus', label: 'Signing bonus', outcome: 'dropped', before: formatMoney(offer.signingBonus.amount) });
    signingBonus = null;
  } else if (offer.signingBonus === null) {
    // No bonus is a decision too, but there's nothing to show for it.
    signingBonus = sameSide ? null : (bolto.signingBonus ?? null);
  } else {
    const describe = (b: SigningBonus) => formatMoney(b.amount);
    signingBonus = sided('signingBonus', 'Signing bonus', offer.signingBonus, sameSide, bolto.signingBonus ?? undefined, describe);
  }

  let equity = offer.equity;
  if (equity?.trim()) {
    if (to === 'contractor') {
      items.push({ id: 'equity', label: 'Equity', outcome: 'dropped', before: equity });
      equity = null;
    } else {
      items.push({ id: 'equity', label: 'Equity', outcome: 'kept', before: equity });
    }
  }

  const autoInvite = offer.hireSetup?.autoInvite ?? true;
  const hireSetup = sameSide
    ? offer.hireSetup
    : bolto.hireSetup
      ? { ...bolto.hireSetup, autoInvite }
      : defaultHireSetup(to, { pay }, autoInvite);
  if (offer.hireSetup) {
    const changed = !sameSide && describeHireSetup(offer.hireSetup) !== describeHireSetup(hireSetup!);
    items.push({
      id: 'hireSetup',
      label: 'Payroll setup',
      outcome: changed ? 'replaced' : 'kept',
      before: describeHireSetup(offer.hireSetup),
      after: changed ? describeHireSetup(hireSetup!) : undefined,
    });
  }

  const style = to === 'custom' ? undefined : letterStyle;
  const { id: _id, candidate: _c, status: _s, statusChangedOn: _d, ...current } = offer;
  return {
    details: { ...current, templateId: to, letterStyle: style, employment, pay, signingBonus, equity, hireSetup },
    items,
    patch: {
      templateId: to,
      letterStyle: style ?? null,
      employment: employment ?? null,
      pay: pay ?? null,
      ...(signingBonus !== undefined ? { signingBonus } : !sameSide && { signingBonus: null }),
      hireSetup: hireSetup ?? null,
      ...(equity !== offer.equity && { equity: null }),
    },
  };
}
