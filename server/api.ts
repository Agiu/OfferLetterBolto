import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NewOffer, OfferPatch, OffersDatabase } from './database';
import { InvalidRequestError, NotFoundError } from './errors';

// JSON API for the offers database, mounted at /api by the Vite plugin in vite.config.ts.
//
//   GET    /api/templates
//   GET    /api/letter-styles
//   GET    /api/candidates
//   GET    /api/offers
//   GET    /api/offers/:id
//   POST   /api/offers        { candidateId, templateId, letterStyle?, title }
//   PATCH  /api/offers/:id    any offer fields to change
//   DELETE /api/offers/:id

type Handler = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void;

const MAX_BODY_BYTES = 1_000_000;

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new InvalidRequestError('Request body is too large.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidRequestError('Request body isn’t valid JSON.');
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidRequestError('Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function createApiHandler(db: OffersDatabase): Handler {
  const route = async (method: string, path: string[], req: IncomingMessage) => {
    const [resource, id, ...rest] = path;
    if (rest.length > 0) return undefined;

    if (method === 'GET' && !id) {
      if (resource === 'templates') return [200, db.listTemplates()] as const;
      if (resource === 'letter-styles') return [200, db.listLetterStyles()] as const;
      if (resource === 'candidates') return [200, db.listCandidates()] as const;
      if (resource === 'offers') return [200, db.listOffers()] as const;
    }

    if (resource !== 'offers') return undefined;

    if (method === 'POST' && !id) {
      const body = asObject(await readJson(req)) as unknown as NewOffer;
      return [201, db.createOffer(body)] as const;
    }
    if (id && method === 'GET') return [200, db.getOffer(id)] as const;
    if (id && method === 'PATCH') {
      const patch = asObject(await readJson(req)) as OfferPatch;
      return [200, db.updateOffer(id, patch)] as const;
    }
    if (id && method === 'DELETE') {
      db.deleteOffer(id);
      return [204, undefined] as const;
    }
    return undefined;
  };

  return (req, res, next) => {
    // Mounted at /api, so req.url is the rest of the path, e.g. "/offers/offer-123".
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    route(req.method ?? 'GET', path, req)
      .then((result) => {
        if (!result) return send(res, 404, { error: `No route for ${req.method} /api${url.pathname}.` });
        send(res, result[0], result[1]);
      })
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) return send(res, 404, { error: error.message });
        if (error instanceof InvalidRequestError) return send(res, 400, { error: error.message });
        console.error('[api]', error);
        if (res.headersSent) return next(error);
        send(res, 500, { error: 'Something went wrong saving to the database.' });
      });
  };
}
