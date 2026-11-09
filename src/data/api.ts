import type {
  Candidate,
  LetterStyle,
  LetterStyleOption,
  Offer,
  OfferDetails,
  OfferStatus,
  OfferTemplate,
  Person,
  TemplateId,
} from './types';

// Talks to the offers database served at /api (see server/api.ts).

export interface NewOffer {
  candidateId: string;
  templateId: TemplateId;
  letterStyle?: LetterStyle;
  title: string;
}

/** Fields to change on an offer. `null` clears a field; for signingBonus it means "no bonus". */
export type OfferPatch = Partial<{ [K in keyof OfferDetails]: OfferDetails[K] | null }> & {
  /** The candidate's name and email. Only the ones given change. */
  candidate?: Partial<Person>;
  jobTitle?: string;
  status?: OfferStatus;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: undefined }));
    throw new Error(error ?? `${method} /api${path} failed (${response.status}).`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  listTemplates: () => request<OfferTemplate[]>('GET', '/templates'),
  listLetterStyles: () => request<LetterStyleOption[]>('GET', '/letter-styles'),
  listCandidates: () => request<Candidate[]>('GET', '/candidates'),
  listOffers: () => request<Offer[]>('GET', '/offers'),
  createOffer: (offer: NewOffer) => request<Offer>('POST', '/offers', offer),
  updateOffer: (id: string, patch: OfferPatch) =>
    request<Offer>('PATCH', `/offers/${encodeURIComponent(id)}`, patch),
  deleteOffer: (id: string) => request<void>('DELETE', `/offers/${encodeURIComponent(id)}`),
};
