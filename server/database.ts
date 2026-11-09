import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
} from '../src/data/types';
import { prefillFor } from '../src/data/prefill';
import { InvalidRequestError, NotFoundError } from './errors';
import * as seed from './seed';

export const OFFER_STATUSES: readonly OfferStatus[] = [
  'draft',
  'ready',
  'sent',
  'viewed',
  'signed',
  'declined',
  'expired',
  'voided',
];

/** The offer fields kept in the `details` JSON column. Job title has its own column. */
type StoredDetails = Partial<Omit<OfferDetails, 'jobTitle'>>;

/** What a client may change on an offer. Sending `null` clears a field (except signingBonus, where null means "no bonus"). */
export type OfferPatch = Partial<{
  [K in keyof StoredDetails]: StoredDetails[K] | null;
}> & {
  /** The candidate's name and email, as written on this offer. Only the ones given change. */
  candidate?: Partial<Person>;
  jobTitle?: string;
  status?: OfferStatus;
};

export interface NewOffer {
  candidateId: string;
  templateId: TemplateId;
  letterStyle?: LetterStyle;
  title: string;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS templates (
    id       TEXT PRIMARY KEY,
    label    TEXT NOT NULL,
    kind     TEXT NOT NULL,
    name     TEXT NOT NULL,
    info     TEXT,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS letter_styles (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    description TEXT NOT NULL,
    position    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL UNIQUE,
    job_title TEXT NOT NULL,
    prefill   TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS offers (
    id                TEXT PRIMARY KEY,
    candidate_id      TEXT REFERENCES candidates(id) ON DELETE SET NULL,
    candidate_name    TEXT NOT NULL,
    candidate_email   TEXT NOT NULL,
    job_title         TEXT NOT NULL,
    status            TEXT NOT NULL CHECK (status IN (${OFFER_STATUSES.map((s) => `'${s}'`).join(', ')})),
    status_changed_on TEXT NOT NULL,
    details           TEXT NOT NULL DEFAULT '{}',
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS offers_by_recent ON offers (status_changed_on DESC, created_at DESC);
`;

interface OfferRow {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  status: OfferStatus;
  status_changed_on: string;
  details: string;
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toOffer(row: OfferRow): Offer {
  return {
    ...(JSON.parse(row.details) as StoredDetails),
    id: row.id,
    candidate: { name: row.candidate_name, email: row.candidate_email },
    jobTitle: row.job_title,
    status: row.status,
    statusChangedOn: row.status_changed_on,
  };
}

export type OffersDatabase = ReturnType<typeof openDatabase>;

export function openDatabase(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  transaction(() => {
    const upsertTemplate = db.prepare(`
      INSERT INTO templates (id, label, kind, name, info, position)
      VALUES (:id, :label, :kind, :name, :info, :position)
      ON CONFLICT (id) DO UPDATE SET
        label = excluded.label, kind = excluded.kind, name = excluded.name,
        info = excluded.info, position = excluded.position
    `);
    seed.templates.forEach((t, position) =>
      upsertTemplate.run({ ...t, info: t.info ?? null, position }),
    );

    const upsertStyle = db.prepare(`
      INSERT INTO letter_styles (id, label, description, position)
      VALUES (:id, :label, :description, :position)
      ON CONFLICT (id) DO UPDATE SET
        label = excluded.label, description = excluded.description, position = excluded.position
    `);
    seed.letterStyles.forEach((s, position) => upsertStyle.run({ ...s, position }));

    const insertCandidate = db.prepare(`
      INSERT INTO candidates (id, name, email, job_title, prefill)
      VALUES (:id, :name, :email, :jobTitle, :prefill)
      ON CONFLICT DO NOTHING
    `);
    for (const c of seed.candidates) {
      insertCandidate.run({
        id: c.id,
        name: c.name,
        email: c.email,
        jobTitle: c.jobTitle,
        prefill: JSON.stringify(c.prefill),
      });
    }
  });

  const getOfferRow = (id: string) => {
    const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(id) as OfferRow | undefined;
    if (!row) throw new NotFoundError(`No offer with id "${id}".`);
    return row;
  };

  const listCandidates = (): Candidate[] =>
    (
      db.prepare('SELECT * FROM candidates ORDER BY name').all() as unknown as {
        id: string;
        name: string;
        email: string;
        job_title: string;
        prefill: string;
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      jobTitle: row.job_title,
      prefill: JSON.parse(row.prefill),
    }));

  return {
    listTemplates: (): OfferTemplate[] =>
      (
        db.prepare('SELECT id, label, kind, name, info FROM templates ORDER BY position').all() as unknown as (Omit<
          OfferTemplate,
          'info'
        > & { info: string | null })[]
      ).map(({ info, ...t }) => (info === null ? t : { ...t, info })),

    listLetterStyles: (): LetterStyleOption[] =>
      db
        .prepare('SELECT id, label, description FROM letter_styles ORDER BY position')
        .all() as unknown as LetterStyleOption[],

    listCandidates,

    listOffers: (): Offer[] =>
      (
        db
          .prepare('SELECT * FROM offers ORDER BY status_changed_on DESC, created_at DESC')
          .all() as unknown as OfferRow[]
      ).map(toOffer),

    getOffer: (id: string) => toOffer(getOfferRow(id)),

    /** Starts a draft for a candidate, pre-filled with what Bolto already knows about the role. */
    createOffer({ candidateId, templateId, letterStyle, title }: NewOffer): Offer {
      const candidate = listCandidates().find((c) => c.id === candidateId);
      if (!candidate) throw new InvalidRequestError(`No candidate with id "${candidateId}".`);
      if (!db.prepare('SELECT 1 FROM templates WHERE id = ?').get(templateId)) {
        throw new InvalidRequestError(`No template with id "${templateId}".`);
      }
      if (!title?.trim()) throw new InvalidRequestError('The offer needs a title.');

      const { jobTitle, ...known } = prefillFor(candidate.prefill, templateId);
      const details: StoredDetails = {
        ...known,
        templateId,
        letterStyle: templateId === 'custom' ? undefined : letterStyle,
        title: title.trim(),
      };

      const id = `offer-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO offers (id, candidate_id, candidate_name, candidate_email, job_title, status, status_changed_on, details)
        VALUES (:id, :candidateId, :name, :email, :jobTitle, 'draft', :today, :details)
      `).run({
        id,
        candidateId: candidate.id,
        name: candidate.name,
        email: candidate.email,
        jobTitle: jobTitle ?? candidate.jobTitle,
        today: todayIso(),
        details: JSON.stringify(details),
      });
      return toOffer(getOfferRow(id));
    },

    /** Saves changes to an offer. Unlisted fields are left as they are. */
    updateOffer(id: string, patch: OfferPatch): Offer {
      return transaction(() => {
        const row = getOfferRow(id);
        const { jobTitle, status, candidate, ...detailChanges } = patch;
        if (status !== undefined && !OFFER_STATUSES.includes(status)) {
          throw new InvalidRequestError(`Unknown status "${status}".`);
        }
        if (detailChanges.templateId && !db.prepare('SELECT 1 FROM templates WHERE id = ?').get(detailChanges.templateId)) {
          throw new InvalidRequestError(`No template with id "${detailChanges.templateId}".`);
        }
        if (jobTitle !== undefined && !jobTitle.trim()) {
          throw new InvalidRequestError('Job title can’t be empty.');
        }
        if (candidate?.name !== undefined && !candidate.name.trim()) {
          throw new InvalidRequestError('The candidate’s name can’t be empty.');
        }
        if (candidate?.email !== undefined && !candidate.email.trim()) {
          throw new InvalidRequestError('The candidate’s email can’t be empty.');
        }

        const details: Record<string, unknown> = { ...JSON.parse(row.details), ...detailChanges };
        for (const [key, value] of Object.entries(details)) {
          if (value === null && key !== 'signingBonus') delete details[key];
        }

        const nextStatus = status ?? row.status;
        // Drafts show when they were last edited; everything else shows when its status changed.
        const touched = nextStatus !== row.status || nextStatus === 'draft';

        db.prepare(`
          UPDATE offers SET
            candidate_name = :candidateName,
            candidate_email = :candidateEmail,
            job_title = :jobTitle,
            status = :status,
            status_changed_on = :statusChangedOn,
            details = :details,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = :id
        `).run({
          id,
          candidateName: candidate?.name?.trim() ?? row.candidate_name,
          candidateEmail: candidate?.email?.trim() ?? row.candidate_email,
          jobTitle: jobTitle?.trim() ?? row.job_title,
          status: nextStatus,
          statusChangedOn: touched ? todayIso() : row.status_changed_on,
          details: JSON.stringify(details),
        });
        return toOffer(getOfferRow(id));
      });
    },

    deleteOffer(id: string) {
      const { changes } = db.prepare('DELETE FROM offers WHERE id = ?').run(id);
      if (changes === 0) throw new NotFoundError(`No offer with id "${id}".`);
    },
  };
}
