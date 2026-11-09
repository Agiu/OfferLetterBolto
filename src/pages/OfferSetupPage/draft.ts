import type { OfferPatch } from '../../data/api';
import type { HireSetup, Offer, OfferDetails, PayBasis, TemplateId } from '../../data/types';
import { recipientOf, type FieldKey, type Recipient } from '../../lib/letter';
import { readWorkLocation } from '../../lib/workLocation';

/** What the set-up page edits: the offer's details, job title and who it goes to included. */
export type Draft = Partial<OfferDetails> & { jobTitle: string; recipient: Recipient };

const blank = (value: string) => (value.trim() === '' ? undefined : value);

/** Pay basis to show before an amount is entered. */
export const defaultBasis = (templateId: TemplateId): PayBasis =>
  templateId === 'contractor' ? 'hourly' : 'salary';

/** Payroll group that matches the template and pay, used until someone picks one. */
function defaultPayrollType(templateId: TemplateId, basis?: PayBasis): HireSetup['payrollType'] {
  if (templateId === 'contractor') return 'Contractor';
  return basis === 'hourly' ? 'US Hourly' : 'US Salaried';
}

export function draftFromOffer(offer: Offer): Draft {
  const { id: _id, candidate: _c, status: _s, statusChangedOn: _d, ...details } = offer;
  const templateId = offer.templateId ?? 'custom';
  const contractor = templateId === 'contractor';
  // Older drafts keep arrangement and office in one line ("Hybrid · New York office"): split them.
  const { arrangement, workplace } = readWorkLocation(details);
  return {
    ...details,
    recipient: recipientOf(offer.candidate),
    workLocation: arrangement,
    workplace,
    hireSetup: {
      payrollType: defaultPayrollType(templateId, details.pay?.basis),
      i9Required: !contractor,
      autoInvite: true,
      ...details.hireSetup,
    },
  };
}

/** The raw value an inline field edits. */
export function readField(draft: Draft, key: FieldKey): string {
  switch (key) {
    case 'title':
      return draft.title ?? '';
    case 'candidateFirstName':
      return draft.recipient.firstName;
    case 'candidateLastName':
      return draft.recipient.lastName;
    case 'candidateEmail':
      return draft.recipient.email;
    case 'jobTitle':
      return draft.jobTitle;
    case 'department':
      return draft.department ?? '';
    case 'workplace':
      return draft.workplace ?? '';
    case 'equity':
      return draft.equity ?? '';
    case 'senderEmail':
      return draft.sender?.email ?? '';
    case 'employmentType':
      return draft.employment?.type === 'contractor' ? '' : (draft.employment?.type ?? '');
    case 'startDate':
      return draft.startDate ?? '';
    case 'endsOn':
      return draft.employment?.type === 'contractor' ? (draft.employment.endsOn ?? '') : '';
    case 'reportsTo':
      return draft.reportsTo ?? '';
    case 'workLocation':
      return draft.workLocation ?? '';
    case 'pay':
      return draft.pay ? String(draft.pay.amount) : '';
    case 'signingBonus':
      return draft.signingBonus ? String(draft.signingBonus.amount) : '';
    case 'bonusRepay':
      return draft.signingBonus?.repayWithinMonths ? String(draft.signingBonus.repayWithinMonths) : '';
    case 'flsa':
      return draft.hireSetup?.flsa ?? '';
    case 'expiresOn':
      return draft.expiresOn ?? '';
    case 'senderName':
      return draft.sender?.name ?? '';
    case 'senderTitle':
      return draft.sender?.title ?? '';
  }
}

const toAmount = (value: string) => {
  const amount = Number(value.replace(/[^0-9.]/g, ''));
  return value.trim() === '' || !Number.isFinite(amount) ? undefined : Math.round(amount);
};

/** The draft with one inline field changed. Clearing a field removes the detail. */
export function writeField(draft: Draft, key: FieldKey, value: string, templateId: TemplateId): Draft {
  switch (key) {
    case 'title':
      return { ...draft, title: value };
    case 'candidateFirstName':
      return { ...draft, recipient: { ...draft.recipient, firstName: value } };
    case 'candidateLastName':
      return { ...draft, recipient: { ...draft.recipient, lastName: value } };
    case 'candidateEmail':
      return { ...draft, recipient: { ...draft.recipient, email: value } };
    case 'jobTitle':
      return { ...draft, jobTitle: value };
    case 'department':
      return { ...draft, department: blank(value) === undefined ? undefined : value };
    case 'workplace':
      return { ...draft, workplace: blank(value) === undefined ? undefined : value };
    case 'equity':
      return { ...draft, equity: blank(value) === undefined ? null : value };
    case 'senderEmail':
      return { ...draft, sender: { name: draft.sender?.name ?? '', title: draft.sender?.title ?? '', email: value } };
    case 'employmentType':
      return {
        ...draft,
        employment: value === 'full-time' || value === 'part-time' ? { type: value } : undefined,
      };
    case 'startDate':
      return { ...draft, startDate: blank(value) };
    case 'endsOn':
      return { ...draft, employment: { type: 'contractor', endsOn: blank(value) } };
    case 'reportsTo':
      return { ...draft, reportsTo: blank(value) === undefined ? undefined : value };
    case 'workLocation':
      return { ...draft, workLocation: value === 'remote' || value === 'hybrid' || value === 'on-site' ? value : undefined };
    case 'pay': {
      const amount = toAmount(value);
      const basis = draft.pay?.basis ?? defaultBasis(templateId);
      return { ...draft, pay: amount === undefined ? undefined : { basis, amount } };
    }
    case 'signingBonus': {
      const amount = toAmount(value);
      return {
        ...draft,
        signingBonus:
          amount === undefined || amount === 0
            ? null
            : { amount, repayWithinMonths: draft.signingBonus?.repayWithinMonths ?? 12 },
      };
    }
    case 'bonusRepay':
      return draft.signingBonus
        ? { ...draft, signingBonus: { ...draft.signingBonus, repayWithinMonths: toAmount(value) } }
        : draft;
    case 'flsa':
      return {
        ...draft,
        hireSetup: {
          ...draft.hireSetup!,
          flsa: value === 'exempt' || value === 'non-exempt' ? value : undefined,
        },
      };
    case 'expiresOn':
      return { ...draft, expiresOn: blank(value) };
    case 'senderName':
      return { ...draft, sender: { ...draft.sender, name: value, title: draft.sender?.title ?? '' } };
    case 'senderTitle':
      return { ...draft, sender: { ...draft.sender, name: draft.sender?.name ?? '', title: value } };
  }
}

/** Changes the pay basis (per year / per hour), keeping the amount. */
export function writePayBasis(draft: Draft, basis: PayBasis): Draft {
  const hireSetup =
    draft.hireSetup && draft.hireSetup.payrollType !== 'Contractor'
      ? { ...draft.hireSetup, payrollType: basis === 'hourly' ? ('US Hourly' as const) : ('US Salaried' as const) }
      : draft.hireSetup;
  return { ...draft, pay: draft.pay ? { ...draft.pay, basis } : draft.pay, hireSetup };
}

/** Everything the page edits, as a database update. Empty details are cleared. */
export function toPatch(draft: Draft): OfferPatch {
  const sender =
    draft.sender && (draft.sender.name.trim() || draft.sender.title.trim() || draft.sender.email?.trim())
      ? { ...draft.sender, email: draft.sender.email?.trim() || undefined }
      : null;
  const { firstName, lastName, email } = draft.recipient;
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  return {
    // The candidate's name and email can't be blank either; each is saved once it's filled in.
    ...((name || email.trim()) && {
      candidate: { ...(firstName.trim() && lastName.trim() && { name }), ...(email.trim() && { email: email.trim() }) },
    }),
    // Title and job title can't be blank in the database; a blank one just isn't saved yet.
    ...(draft.title?.trim() && { title: draft.title.trim() }),
    ...(draft.jobTitle.trim() && { jobTitle: draft.jobTitle.trim() }),
    employment: draft.employment ?? null,
    startDate: draft.startDate ?? null,
    reportsTo: draft.reportsTo?.trim() || null,
    department: draft.department?.trim() || null,
    workLocation: draft.workLocation || null,
    workplace: draft.workLocation === 'remote' ? null : draft.workplace?.trim() || null,
    pay: draft.pay ?? null,
    equity: draft.equity?.trim() || null,
    // undefined = never set, null = no bonus.
    ...(draft.signingBonus !== undefined && { signingBonus: draft.signingBonus }),
    hireSetup: draft.hireSetup ?? null,
    expiresOn: draft.expiresOn ?? null,
    sender,
  };
}

/** Puts an offer's details back the way they were in `offer` (for "Don't save"). */
export function restorePatch(offer: Offer): OfferPatch {
  return {
    candidate: offer.candidate,
    jobTitle: offer.jobTitle,
    title: offer.title ?? null,
    department: offer.department ?? null,
    workplace: offer.workplace ?? null,
    equity: offer.equity ?? null,
    employment: offer.employment ?? null,
    startDate: offer.startDate ?? null,
    reportsTo: offer.reportsTo ?? null,
    workLocation: offer.workLocation ?? null,
    pay: offer.pay ?? null,
    signingBonus: offer.signingBonus ?? null,
    hireSetup: offer.hireSetup ?? null,
    expiresOn: offer.expiresOn ?? null,
    sender: offer.sender ?? null,
  };
}
