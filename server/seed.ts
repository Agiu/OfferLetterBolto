import type { Candidate, HireSetup, LetterStyleOption, OfferTemplate, Sender } from '../src/data/types';

// Starting data for a fresh database. Alex Rivera and Priya Shah are the two examples from the
// Figma brief ("Dummy data for your screens and prototype"). There are no offers: the list
// starts empty and fills up as offers are created.
//
// Templates and letter styles belong to the app, so they're rewritten from here on every start.
// Candidates are only inserted when missing, so edits made in the database survive a restart.

export const templates: OfferTemplate[] = [
  {
    id: 'contractor',
    label: '1099',
    kind: 'Contractor',
    name: 'Standard Contractor offer',
    info: 'For independent contractors. They’re paid without tax withholding and get a 1099-NEC at year end. No I-9 or FLSA classification needed.',
  },
  {
    id: 'w2',
    label: 'W-2',
    kind: 'Employee',
    name: 'Standard W-2 offer',
    info: 'For employees on your payroll. Bolto withholds their taxes, files their W-2 and collects an I-9 before they start.',
  },
  {
    id: 'custom',
    label: 'Custom',
    kind: 'Blank letter',
    name: 'Custom offer',
  },
];

export const letterStyles: LetterStyleOption[] = [
  {
    id: 'concise',
    label: 'Concise',
    description: 'Just the key terms: role, pay, start date. About one page.',
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'The full letter, with each term spelled out in plain language.',
  },
];

const SAM_PATEL: Sender = { name: 'Sam Patel', title: 'Head of People', email: 'sam.patel@example.com' };

const SALARIED_EXEMPT: HireSetup = {
  payrollType: 'US Salaried',
  flsa: 'exempt',
  i9Required: true,
  autoInvite: true,
};

const CONTRACTOR: HireSetup = {
  payrollType: 'Contractor',
  i9Required: false,
  autoInvite: true,
};

export const candidates: Candidate[] = [
  {
    id: 'cand-alex-rivera',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    jobTitle: 'Senior full-stack engineer',
    prefill: {
      templateId: 'w2',
      jobTitle: 'Senior full-stack engineer',
      employment: { type: 'full-time' },
      startDate: '2026-06-15',
      reportsTo: 'Jordan Lee',
      department: 'Engineering',
      workLocation: 'remote',
      pay: { basis: 'salary', amount: 150_000 },
      signingBonus: { amount: 10_000, repayWithinMonths: 12 },
      hireSetup: SALARIED_EXEMPT,
      expiresOn: '2026-06-01',
      sender: SAM_PATEL,
    },
  },
  {
    id: 'cand-priya-shah',
    name: 'Priya Shah',
    email: 'priya.shah@example.com',
    jobTitle: 'Product designer',
    prefill: {
      templateId: 'contractor',
      jobTitle: 'Product designer',
      employment: { type: 'contractor', endsOn: '2026-12-31' },
      startDate: '2026-07-01',
      reportsTo: 'Jordan Lee',
      department: 'Design',
      workLocation: 'hybrid',
      workplace: 'New York office',
      pay: { basis: 'hourly', amount: 95 },
      signingBonus: null,
      hireSetup: CONTRACTOR,
      expiresOn: '2026-06-20',
      sender: SAM_PATEL,
    },
  },
];
