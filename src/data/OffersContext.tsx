import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type OfferPatch } from './api';
import type { Candidate, LetterStyle, LetterStyleOption, Offer, OfferTemplate, TemplateId } from './types';

/** What the template step decides. */
export interface TemplateChoices {
  templateId: TemplateId;
  letterStyle?: LetterStyle;
  title: string;
}

interface Data {
  offers: Offer[];
  candidates: Candidate[];
  templates: OfferTemplate[];
  letterStyles: LetterStyleOption[];
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

interface OffersContextValue extends Data {
  load: LoadState;
  /** Candidates who don't have an offer yet. */
  availableCandidates: Candidate[];
  createOffer: (candidate: Candidate, choices: TemplateChoices) => Promise<Offer>;
  updateOffer: (id: string, patch: OfferPatch) => Promise<Offer>;
  deleteOffer: (id: string) => Promise<void>;
}

const OffersContext = createContext<OffersContextValue | null>(null);

const EMPTY: Data = { offers: [], candidates: [], templates: [], letterStyles: [] };

/** Same order as the database: most recent status change first, newest first on a tie. */
const byMostRecent = (a: Offer, b: Offer) => b.statusChangedOn.localeCompare(a.statusChangedOn);

export function OffersProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listOffers(), api.listCandidates(), api.listTemplates(), api.listLetterStyles()])
      .then(([offers, candidates, templates, letterStyles]) => {
        if (cancelled) return;
        setData({ offers, candidates, templates, letterStyles });
        setLoad({ status: 'ready' });
      })
      .catch((error: Error) => {
        if (!cancelled) setLoad({ status: 'error', message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableCandidates = useMemo(() => {
    const withOffer = new Set(data.offers.map((o) => o.candidate.email));
    return data.candidates.filter((c) => !withOffer.has(c.email));
  }, [data]);

  const setOffers = (update: (offers: Offer[]) => Offer[]) =>
    setData((current) => ({ ...current, offers: update(current.offers) }));

  const createOffer = useCallback(async (candidate: Candidate, choices: TemplateChoices) => {
    const offer = await api.createOffer({ candidateId: candidate.id, ...choices });
    setOffers((offers) => [offer, ...offers]);
    return offer;
  }, []);

  const updateOffer = useCallback(async (id: string, patch: OfferPatch) => {
    const offer = await api.updateOffer(id, patch);
    setOffers((offers) => offers.map((o) => (o.id === id ? offer : o)).sort(byMostRecent));
    return offer;
  }, []);

  const deleteOffer = useCallback(async (id: string) => {
    await api.deleteOffer(id);
    setOffers((offers) => offers.filter((o) => o.id !== id));
  }, []);

  return (
    <OffersContext.Provider
      value={{ ...data, load, availableCandidates, createOffer, updateOffer, deleteOffer }}
    >
      {children}
    </OffersContext.Provider>
  );
}

export function useOffers() {
  const value = useContext(OffersContext);
  if (!value) throw new Error('useOffers must be used inside <OffersProvider>');
  return value;
}
