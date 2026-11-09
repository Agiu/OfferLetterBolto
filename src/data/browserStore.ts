import * as seed from '../../server/seed';
import { OFFER_STATUS } from './offerStatus';
import { prefillFor } from './prefill';
import type { NewOffer, OfferPatch } from './api';
import type { Candidate, LetterStyleOption, Offer, OfferTemplate } from './types';

// The same offers "database" as server/database.ts, kept in the browser's localStorage so the
// prototype works when it's hosted as plain static files (no server, no accounts). Everyone who
// opens the prototype gets their own copy: drafts and sent offers are saved on that device and
// survive reloads. Templates, letter styles and candidates come from server/seed.ts.

const STORAGE_KEY = 'bolto-offers-v1';

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function load(): Offer[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Offer[]) : [];
  } catch {
    return memory;
  }
}

// Used when storage is blocked (private windows, strict settings): works until the page closes.
let memory: Offer[] = [];

function save(offers: Offer[]) {
  memory = offers;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
  } catch {
    // Storage is full or blocked; the in-memory copy still works for this visit.
  }
}

/** Newest activity first, like the database's ORDER BY. */
function sorted(offers: Offer[]) {
  return [...offers].sort((a, b) => b.statusChangedOn.localeCompare(a.statusChangedOn));
}

const find = (offers: Offer[], id: string) => {
  const offer = offers.find((o) => o.id === id);
  if (!offer) throw new Error(`No offer with id "${id}".`);
  return offer;
};

export const browserApi = {
  listTemplates: async (): Promise<OfferTemplate[]> => structuredClone(seed.templates),
  listLetterStyles: async (): Promise<LetterStyleOption[]> => structuredClone(seed.letterStyles),
  listCandidates: async (): Promise<Candidate[]> =>
    structuredClone([...seed.candidates].sort((a, b) => a.name.localeCompare(b.name))),

  listOffers: async (): Promise<Offer[]> => sorted(load()),

  /** Starts a draft for a candidate, pre-filled with what Bolto already knows about the role. */
  async createOffer({ candidateId, templateId, letterStyle, title }: NewOffer): Promise<Offer> {
    const candidate = seed.candidates.find((c) => c.id === candidateId);
    if (!candidate) throw new Error(`No candidate with id "${candidateId}".`);
    if (!seed.templates.some((t) => t.id === templateId)) throw new Error(`No template with id "${templateId}".`);
    if (!title?.trim()) throw new Error('The offer needs a title.');

    const { jobTitle, ...known } = prefillFor(candidate.prefill, templateId);
    const offer = {
      ...known,
      templateId,
      letterStyle: templateId === 'custom' ? undefined : letterStyle,
      title: title.trim(),
      id: `offer-${crypto.randomUUID()}`,
      candidate: { name: candidate.name, email: candidate.email },
      jobTitle: jobTitle ?? candidate.jobTitle,
      status: 'draft',
      statusChangedOn: todayIso(),
    } as Offer;
    save([...load(), offer]);
    return structuredClone(offer);
  },

  /** Saves changes to an offer. Unlisted fields are left as they are; `null` clears a field. */
  async updateOffer(id: string, patch: OfferPatch): Promise<Offer> {
    const offers = load();
    const row = find(offers, id);
    const { jobTitle, status, candidate, ...detailChanges } = patch;
    if (status !== undefined && !(status in OFFER_STATUS)) throw new Error(`Unknown status "${status}".`);
    if (detailChanges.templateId && !seed.templates.some((t) => t.id === detailChanges.templateId)) {
      throw new Error(`No template with id "${detailChanges.templateId}".`);
    }
    if (jobTitle !== undefined && !jobTitle.trim()) throw new Error('Job title can’t be empty.');
    if (candidate?.name !== undefined && !candidate.name.trim()) throw new Error('The candidate’s name can’t be empty.');
    if (candidate?.email !== undefined && !candidate.email.trim()) throw new Error('The candidate’s email can’t be empty.');

    const next: Record<string, unknown> = { ...row, ...detailChanges };
    for (const [key, value] of Object.entries(next)) {
      if (value === null && key !== 'signingBonus') delete next[key];
    }
    const nextStatus = status ?? row.status;
    // Drafts show when they were last edited; everything else shows when its status changed.
    const touched = nextStatus !== row.status || nextStatus === 'draft';
    const updated = {
      ...next,
      candidate: {
        name: candidate?.name?.trim() ?? row.candidate.name,
        email: candidate?.email?.trim() ?? row.candidate.email,
      },
      jobTitle: jobTitle?.trim() ?? row.jobTitle,
      status: nextStatus,
      statusChangedOn: touched ? todayIso() : row.statusChangedOn,
    } as Offer;
    save(offers.map((o) => (o.id === id ? updated : o)));
    return structuredClone(updated);
  },

  async deleteOffer(id: string): Promise<void> {
    const offers = load();
    find(offers, id);
    save(offers.filter((o) => o.id !== id));
  },
};
