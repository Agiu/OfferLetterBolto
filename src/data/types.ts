export type OfferStatus =
  | 'draft'
  | 'ready'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'voided';

export type EmploymentType = 'full-time' | 'part-time' | 'contractor';

export type PayBasis = 'salary' | 'hourly';

/** ISO calendar date, e.g. "2026-06-15". */
export type IsoDate = string;

export interface Person {
  name: string;
  email: string;
}

export interface Employment {
  type: EmploymentType;
  /** Contract end date, contractors only. */
  endsOn?: IsoDate;
}

export interface Pay {
  basis: PayBasis;
  /** Whole dollars: per year for salary, per hour for hourly. */
  amount: number;
}

export interface SigningBonus {
  amount: number;
  /** Repaid if the hire leaves within this many months. */
  repayWithinMonths?: number;
}

/** The payroll details Bolto uses to set the hire up once they sign. */
export interface HireSetup {
  payrollType: 'US Salaried' | 'US Hourly' | 'Contractor';
  /** FLSA classification. Not applicable to contractors. */
  flsa?: 'exempt' | 'non-exempt';
  i9Required: boolean;
  autoInvite: boolean;
}

export interface Sender {
  name: string;
  title: string;
  /** Where the candidate's reply goes. Older drafts may not have one yet. */
  email?: string;
}

/** Where the work happens. */
export type WorkArrangement = 'remote' | 'hybrid' | 'on-site';

export type TemplateId = 'contractor' | 'w2' | 'custom';

export interface OfferTemplate {
  id: TemplateId;
  /** Short name shown on the template card, e.g. "W-2". */
  label: string;
  /** Who the template is for, e.g. "Employee". */
  kind: string;
  /** Full name, e.g. "Standard W-2 offer". */
  name: string;
  /** Plain-language explanation of the payroll implications, if any. */
  info?: string;
}

export type LetterStyle = 'concise' | 'standard';

export interface LetterStyleOption {
  id: LetterStyle;
  label: string;
  description: string;
}

/** Everything the offer letter says, pays and sets up. */
export interface OfferDetails {
  templateId: TemplateId;
  /** Not used by custom templates, which have their own wording. */
  letterStyle?: LetterStyle;
  /** Letter title. Generated from the candidate's name and position, editable. */
  title: string;
  jobTitle: string;
  employment: Employment;
  startDate: IsoDate;
  reportsTo: string;
  /** Team the role sits in, e.g. "Engineering". */
  department: string;
  /** Remote, hybrid or on-site. Older drafts may hold free text such as "Hybrid · New York office". */
  workLocation: WorkArrangement | string;
  /** The office they work from, e.g. "New York office". Not needed for remote roles. */
  workplace: string;
  pay: Pay;
  signingBonus: SigningBonus | null;
  /** Optional equity grant, in the company's words, e.g. "10,000 stock options vesting over 4 years". null = none. */
  equity: string | null;
  hireSetup: HireSetup;
  expiresOn: IsoDate;
  sender: Sender;
  /** A few words to the candidate that go with the letter. Added on the review step. */
  personalNote: string;
}

/** Drafts can be incomplete, so every detail except the job title is optional. */
export type Offer = Partial<OfferDetails> & {
  id: string;
  candidate: Person;
  jobTitle: string;
  status: OfferStatus;
  /** When the offer last changed status (or was last edited, for drafts). */
  statusChangedOn: IsoDate;
};

/** Someone in the hiring pipeline whose details are already in Bolto. */
export interface Candidate extends Person {
  id: string;
  jobTitle: string;
  /** Details already known about the role, used to pre-fill a new offer. */
  prefill: Partial<OfferDetails>;
}
