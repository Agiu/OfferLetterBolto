import type { FieldKey } from '../lib/letter';

/**
 * The set-up page walks through the offer in the six groups of details it needs (Figma
 * 2045:296), shown in the bar as "1/6 … 6/6". Every editable detail on the letter belongs to
 * one section.
 */
export const SETUP_SECTIONS = [
  { id: 'candidate', label: 'Candidate information' },
  { id: 'employment', label: 'Employment details' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'hire-setup', label: 'Hire setup' },
  { id: 'terms', label: 'Offer terms' },
  { id: 'sender', label: 'Sender' },
] as const;

export type SetupSectionId = (typeof SETUP_SECTIONS)[number]['id'];

export const SECTION_OF: Record<FieldKey, SetupSectionId> = {
  candidateFirstName: 'candidate',
  candidateLastName: 'candidate',
  candidateEmail: 'candidate',
  jobTitle: 'employment',
  department: 'employment',
  employmentType: 'employment',
  startDate: 'employment',
  endsOn: 'employment',
  reportsTo: 'employment',
  workLocation: 'employment',
  workplace: 'employment',
  pay: 'compensation',
  signingBonus: 'compensation',
  bonusRepay: 'compensation',
  equity: 'compensation',
  flsa: 'hire-setup',
  title: 'terms',
  expiresOn: 'terms',
  senderName: 'sender',
  senderTitle: 'sender',
  senderEmail: 'sender',
};

/** Where a section sits in the walk. */
export const sectionIndexOf = (id: SetupSectionId) => SETUP_SECTIONS.findIndex((s) => s.id === id);
