import type { OfferDetails, TemplateId } from './types';

/**
 * What Bolto already knows about the role that applies to an offer on `templateId`.
 * Pay and payroll details only carry over when the template matches what we know about the
 * role; a W-2 salary makes no sense on a contractor offer. Used by the server when it creates
 * a draft and by the letter preview, so both always agree.
 */
export function prefillFor(prefill: Partial<OfferDetails>, templateId: TemplateId): Partial<OfferDetails> {
  if (templateId === prefill.templateId) return prefill;
  const { employment: _e, pay: _p, signingBonus: _s, hireSetup: _h, ...shared } = prefill;
  return shared;
}
