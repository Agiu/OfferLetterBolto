import type { Employment, LetterStyle, OfferDetails, Pay, Person, TemplateId } from '../data/types';
import { formatLongDate, formatMoney } from './format';
import { readWorkLocation } from './workLocation';

// Builds the content of an offer letter from what's known so far. Used read-only for the
// template previews and editable on the set-up page, where each detail with a `key` becomes
// a field you fill in on the letter itself. Anything not known yet is a named gap.
//
// The letter is laid out like an email printed to PDF: who it's from and to, the subject (the
// letter title), then the letter. Every detail the offer needs (Figma 2045:296) is in it.

/** The offer details that can be edited on the letter. */
export type FieldKey =
  | 'title'
  | 'candidateFirstName'
  | 'candidateLastName'
  | 'candidateEmail'
  | 'jobTitle'
  | 'department'
  | 'employmentType'
  | 'startDate'
  | 'endsOn'
  | 'reportsTo'
  | 'workLocation'
  | 'workplace'
  | 'pay'
  | 'signingBonus'
  | 'bonusRepay'
  | 'equity'
  | 'flsa'
  | 'expiresOn'
  | 'senderName'
  | 'senderTitle'
  | 'senderEmail';

/** A detail filled in from the offer. No value means it still needs filling in. */
export interface LetterField {
  field: string;
  value?: string;
  /** Which offer detail this shows, so the set-up page can make it editable. */
  key?: FieldKey;
  /** Optional details never count as missing. */
  optional?: boolean;
  /** Shown but edited elsewhere on the letter (the greeting's name is edited in the To line). */
  readOnly?: boolean;
}

export type Segment = string | LetterField;

export type LetterBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; segments: Segment[] }
  | { kind: 'terms'; rows: { label: string; value: Segment }[] }
  /** Custom letters: the company's own wording. */
  | { kind: 'custom' };

/** The email's header: who it's from and who it's to. */
export interface Envelope {
  from: { name: LetterField; email: LetterField };
  to: { firstName: LetterField; lastName: LetterField; email: LetterField };
}

export interface Letter {
  envelope: Envelope;
  greeting: Segment[];
  blocks: LetterBlock[];
  signOff: { name: Segment; title: Segment };
  /** Every gap still to fill in, once each. */
  missingFields: LetterField[];
  /** How many details are still to fill in. */
  missing: number;
}

/** Who the letter goes to. First and last name are kept apart so each can be edited. */
export interface Recipient {
  firstName: string;
  lastName: string;
  email: string;
}

/** "Alex Rivera" -> first "Alex", last "Rivera". Everything after the first word is the last name. */
export function recipientOf(person: Person): Recipient {
  const [firstName = '', ...rest] = person.name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' '), email: person.email };
}

/** Loose check: something@something.something. */
export const isEmail = (value: string | undefined) => !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export interface BuildOptions {
  /**
   * The set-up page: show optional details (like the signing bonus) even when there's none,
   * so they can be added on the letter.
   */
  editing?: boolean;
}

/** Blank values count as missing. */
const field = (label: string, value: string | null | undefined, key?: FieldKey): LetterField => ({
  field: label,
  value: value?.trim() ? value : undefined,
  key,
});

const optional = (f: LetterField): LetterField => ({ ...f, optional: true });

/** An email address; one that isn't valid yet still needs filling in. */
const email = (label: string, value: string | undefined, key: FieldKey) =>
  field(label, isEmail(value) ? value : undefined, key);

/** For table cells: "full-time" -> "Full-time". Mid-sentence values stay lower case. */
const capitalize = (f: LetterField): LetterField =>
  f.value === undefined ? f : { ...f, value: f.value[0].toUpperCase() + f.value.slice(1) };

const date = (label: string, iso: string | undefined, key: FieldKey) =>
  field(label, iso && formatLongDate(iso), key);

function employeeType(employment?: Employment) {
  if (employment?.type === 'full-time' || employment?.type === 'part-time') return employment.type;
  return undefined;
}

const payAmount = (pay: Pay) =>
  `${formatMoney(pay.amount)} per ${pay.basis === 'salary' ? 'year' : 'hour'}`;

/** Where the work happens: the arrangement, and the workplace unless it's remote. */
function workLocation(d: Partial<OfferDetails>) {
  const { arrangement, workplace } = readWorkLocation(d);
  return {
    arrangement: field('Remote, hybrid or on-site', arrangement, 'workLocation'),
    workplace: arrangement === 'remote' ? undefined : field('Workplace', workplace, 'workplace'),
  };
}

/** "…is hybrid, based at New York office." / "…is remote." */
function locationSentence(lead: string, d: Partial<OfferDetails>): Segment[] {
  const { arrangement, workplace } = workLocation(d);
  return workplace ? [lead, arrangement, ', based at ', workplace, '.'] : [lead, arrangement, '.'];
}

/** Table rows for where the work happens. */
function locationRows(d: Partial<OfferDetails>) {
  const { arrangement, workplace } = workLocation(d);
  return [
    { label: 'Location', value: capitalize(arrangement) },
    ...(workplace ? [{ label: 'Workplace', value: workplace }] : []),
  ];
}

function findMissing(letter: Omit<Letter, 'missing' | 'missingFields'>) {
  const { from, to } = letter.envelope;
  const segments: Segment[] = [
    from.name,
    from.email,
    to.firstName,
    to.lastName,
    to.email,
    ...letter.greeting,
    letter.signOff.name,
    letter.signOff.title,
    ...letter.blocks.flatMap((block) =>
      block.kind === 'paragraph'
        ? block.segments
        : block.kind === 'terms'
          ? block.rows.map((row) => row.value)
          : [],
    ),
  ];
  // The same detail can appear twice in a letter; count it once.
  const missing = new Map<string, LetterField>();
  for (const s of segments) {
    if (typeof s !== 'string' && s.value === undefined && !s.optional) missing.set(s.key ?? s.field, s);
  }
  return [...missing.values()];
}

/** The signing bonus sentence, or (when editing) a line to add one. */
function bonusBlocks(bonus: OfferDetails['signingBonus'] | undefined, editing: boolean): LetterBlock[] {
  if (bonus) {
    return [
      {
        kind: 'paragraph',
        segments: [
          'You’ll also receive a one-time signing bonus of ',
          field('Signing bonus', formatMoney(bonus.amount), 'signingBonus'),
          '. If you leave within ',
          optional(field('Months', bonus.repayWithinMonths ? String(bonus.repayWithinMonths) : undefined, 'bonusRepay')),
          ' months of your start date, you’ll be asked to repay it.',
        ],
      },
    ];
  }
  if (!editing) return [];
  return [{ kind: 'paragraph', segments: ['Signing bonus: ', optional(field('None', undefined, 'signingBonus'))] }];
}

/** The equity sentence, or (when editing) a line to add a grant. */
function equityBlocks(equity: string | null | undefined, editing: boolean): LetterBlock[] {
  if (equity?.trim()) {
    return [
      {
        kind: 'paragraph',
        segments: [
          'You’ll also be granted ',
          optional(field('None', equity, 'equity')),
          ', subject to the company’s equity plan and your grant agreement.',
        ],
      },
    ];
  }
  if (!editing) return [];
  return [{ kind: 'paragraph', segments: ['Equity: ', optional(field('None', undefined, 'equity'))] }];
}

function employeeLetter(d: Partial<OfferDetails>, style: LetterStyle, editing: boolean): LetterBlock[] {
  const role = field('Job title', d.jobTitle, 'jobTitle');
  const department = field('Department', d.department, 'department');
  const type = field('Full-time or part-time', employeeType(d.employment), 'employmentType');
  const manager = field('Manager', d.reportsTo, 'reportsTo');
  const start = date('Start date', d.startDate, 'startDate');
  const salaried = d.pay?.basis !== 'hourly';
  const pay = field(salaried ? 'Annual salary' : 'Hourly rate', d.pay && payAmount(d.pay), 'pay');
  const flsa = field('Exempt or non-exempt', d.hireSetup?.flsa, 'flsa');
  const expires = date('Offer expiry date', d.expiresOn, 'expiresOn');
  const bonus = d.signingBonus;
  const equity = d.equity;

  if (style === 'concise') {
    return [
      { kind: 'paragraph', segments: ['We’re pleased to offer you the position of ', role, '. The key terms are below.'] },
      {
        kind: 'terms',
        rows: [
          { label: 'Position', value: role },
          { label: 'Department', value: department },
          { label: 'Employment', value: capitalize(type) },
          { label: 'Start date', value: start },
          { label: 'Reports to', value: manager },
          ...locationRows(d),
          { label: salaried ? 'Salary' : 'Pay rate', value: pay },
          ...(bonus === undefined && !editing
            ? []
            : [{ label: 'Signing bonus', value: optional(field('None', bonus ? formatMoney(bonus.amount) : undefined, 'signingBonus')) }]),
          ...(!equity?.trim() && !editing ? [] : [{ label: 'Equity', value: optional(field('None', equity, 'equity')) }]),
          { label: 'FLSA status', value: capitalize(flsa) },
          { label: 'Offer expires', value: expires },
        ],
      },
      {
        kind: 'paragraph',
        segments: ['Employment is at-will. To accept, sign this letter by ', expires, '.'],
      },
    ];
  }

  return [
    {
      kind: 'paragraph',
      segments: [
        'We’re delighted to offer you the position of ',
        role,
        '. This letter sets out the terms of your employment with us.',
      ],
    },
    { kind: 'heading', text: 'Your role' },
    {
      kind: 'paragraph',
      segments: [
        'This is a ',
        type,
        ' position in the ',
        department,
        ' team, reporting to ',
        manager,
        '. Your first day will be ',
        start,
        '. ',
        ...locationSentence('The role is ', d),
      ],
    },
    { kind: 'heading', text: 'Pay' },
    {
      kind: 'paragraph',
      segments: [
        salaried ? 'Your starting salary is ' : 'Your pay rate is ',
        pay,
        ', paid on our regular payroll schedule, less applicable taxes and withholdings.',
      ],
    },
    ...bonusBlocks(bonus, editing),
    ...equityBlocks(equity, editing),
    { kind: 'heading', text: 'Classification and paperwork' },
    {
      kind: 'paragraph',
      segments: [
        'For overtime purposes, this role is classified as ',
        flsa,
        ' under the Fair Labor Standards Act. Before your first day, you’ll complete Form I-9 to confirm you’re eligible to work in the United States.',
      ],
    },
    { kind: 'heading', text: 'At-will employment' },
    {
      kind: 'paragraph',
      segments: [
        'Your employment is at-will: you or the company can end it at any time, with or without cause or notice. Nothing in this letter is a contract for any fixed period.',
      ],
    },
    { kind: 'heading', text: 'Accepting this offer' },
    {
      kind: 'paragraph',
      segments: [
        'This offer is open until ',
        expires,
        '. To accept, sign this letter electronically. We’re looking forward to working with you.',
      ],
    },
  ];
}

function contractorLetter(d: Partial<OfferDetails>, style: LetterStyle): LetterBlock[] {
  const role = field('Services', d.jobTitle, 'jobTitle');
  const department = field('Department', d.department, 'department');
  const hourly = d.pay?.basis !== 'salary';
  const rate = field(hourly ? 'Hourly rate' : 'Annual fee', d.pay && payAmount(d.pay), 'pay');
  const ends = date('End date', d.employment?.type === 'contractor' ? d.employment.endsOn : undefined, 'endsOn');
  const expires = date('Offer expiry date', d.expiresOn, 'expiresOn');
  const contact = field('Point of contact', d.reportsTo, 'reportsTo');

  if (style === 'concise') {
    return [
      {
        kind: 'paragraph',
        segments: ['We’re pleased to engage you as an independent contractor for ', role, '. The key terms are below.'],
      },
      {
        kind: 'terms',
        rows: [
          { label: 'Services', value: role },
          { label: 'Department', value: department },
          { label: 'Start date', value: date('Start date', d.startDate, 'startDate') },
          { label: 'End date', value: ends },
          { label: 'Point of contact', value: contact },
          ...locationRows(d),
          { label: hourly ? 'Rate' : 'Fee', value: rate },
          { label: 'Offer expires', value: expires },
        ],
      },
      {
        kind: 'paragraph',
        segments: ['You’re engaged as a contractor, not an employee. To accept, sign this letter by ', expires, '.'],
      },
    ];
  }

  return [
    {
      kind: 'paragraph',
      segments: [
        'We’re pleased to offer you an engagement as an independent contractor, providing services as ',
        role,
        '. This letter sets out the terms of the engagement.',
      ],
    },
    { kind: 'heading', text: 'The engagement' },
    {
      kind: 'paragraph',
      segments: [
        'The engagement starts on ',
        date('Start date', d.startDate, 'startDate'),
        ' and ends on ',
        ends,
        '. You’ll work with the ',
        department,
        ' team, and your point of contact will be ',
        contact,
        '. ',
        ...locationSentence('The work is ', d),
      ],
    },
    { kind: 'heading', text: 'Fees' },
    {
      kind: 'paragraph',
      segments: [
        'You’ll be paid ',
        rate,
        ' for services performed, invoiced monthly. No taxes are withheld: you’re responsible for your own tax filings, and we’ll send you a Form 1099-NEC at year end.',
      ],
    },
    { kind: 'heading', text: 'Independent contractor status' },
    {
      kind: 'paragraph',
      segments: [
        'You decide how, when and where the work is done, and you’re free to work for others. As a contractor you aren’t eligible for employee benefits, and this letter doesn’t create an employment relationship.',
      ],
    },
    { kind: 'heading', text: 'Accepting this offer' },
    {
      kind: 'paragraph',
      segments: ['This offer is open until ', expires, '. To accept, sign this letter electronically.'],
    },
  ];
}

/** Custom letters: the company's own wording, with the key terms it draws on listed under it. */
function customLetter(d: Partial<OfferDetails>, editing: boolean): LetterBlock[] {
  return [
    { kind: 'custom' },
    {
      kind: 'terms',
      rows: [
        { label: 'Position', value: field('Job title', d.jobTitle, 'jobTitle') },
        { label: 'Department', value: field('Department', d.department, 'department') },
        { label: 'Start date', value: date('Start date', d.startDate, 'startDate') },
        { label: 'Reports to', value: field('Manager', d.reportsTo, 'reportsTo') },
        ...locationRows(d),
        { label: 'Pay', value: field('Pay', d.pay && payAmount(d.pay), 'pay') },
        ...(!d.equity?.trim() && !editing ? [] : [{ label: 'Equity', value: optional(field('None', d.equity, 'equity')) }]),
        { label: 'Offer expires', value: date('Offer expiry date', d.expiresOn, 'expiresOn') },
      ],
    },
  ];
}

/**
 * The letter to `recipient` on a template and style. `details` is what's known about the
 * offer so far (see prefillFor). Custom templates ignore the style.
 */
export function buildLetter(
  recipient: Recipient,
  details: Partial<OfferDetails>,
  templateId: TemplateId,
  style: LetterStyle,
  { editing = false }: BuildOptions = {},
): Letter {
  const blocks: LetterBlock[] =
    templateId === 'w2'
      ? employeeLetter(details, style, editing)
      : templateId === 'contractor'
        ? contractorLetter(details, style)
        : customLetter(details, editing);

  const firstName = field('First name', recipient.firstName, 'candidateFirstName');
  const letter = {
    envelope: {
      from: {
        name: field('Sender name', details.sender?.name, 'senderName'),
        email: email('Sender email', details.sender?.email, 'senderEmail'),
      },
      to: {
        firstName,
        lastName: field('Last name', recipient.lastName, 'candidateLastName'),
        email: email('Candidate email', recipient.email, 'candidateEmail'),
      },
    },
    greeting: ['Dear ', { ...firstName, readOnly: true }, ','],
    blocks,
    signOff: {
      name: field('Sender name', details.sender?.name, 'senderName'),
      title: field('Sender title', details.sender?.title, 'senderTitle'),
    },
  };
  const missingFields = findMissing(letter);
  return { ...letter, missingFields, missing: missingFields.length };
}
