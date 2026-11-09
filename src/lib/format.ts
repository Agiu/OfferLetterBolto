import type { Candidate, Employment, IsoDate, Pay } from '../data/types';

/** The automatic letter title from the user flow: name + "Offer letter" + position. */
export const defaultLetterTitle = (candidate: Pick<Candidate, 'name' | 'jobTitle'>) =>
  `${candidate.name} offer letter, ${candidate.jobTitle}`;

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** "2026-06-15" -> "Jun 15, 2026". Parsed as a local date so it never shifts a day. */
export function formatDate(iso: IsoDate) {
  const [year, month, day] = iso.split('-').map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

const longDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** "2026-06-15" -> "June 15, 2026", for letter prose. */
export function formatLongDate(iso: IsoDate) {
  const [year, month, day] = iso.split('-').map(Number);
  return longDateFormat.format(new Date(year, month - 1, day));
}

/** 150000 -> "$150,000". */
export const formatMoney = (amount: number) => usd.format(amount);

export function todayIso(): IsoDate {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatPay(pay: Pay) {
  return `${usd.format(pay.amount)} / ${pay.basis === 'salary' ? 'year' : 'hour'}`;
}

const EMPLOYMENT_LABEL: Record<Employment['type'], string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contractor: 'Contractor',
};

export const formatEmployment = (employment: Employment) => EMPLOYMENT_LABEL[employment.type];
