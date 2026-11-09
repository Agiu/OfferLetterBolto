# Bolto - Offer Letter Prototype

A prototype of the offer letter journey for Bolto: pick a template, set up the letter, review it and send it. It started as a design challenge, so it's built to feel real rather than to be finished. There's also a little promo page that explains what's different about the journey.

## Run it locally

You'll need **Node 22.5 or newer**. The local database uses Node's built-in SQLite, and older versions don't have it. Check with `node -v`.

```
npm install
npm run dev
```

Then open http://localhost:5173.

That's it. There's no database to set up. The first time it runs, it makes one at `data/bolto.db` and fills it with two candidates (Alex Rivera and Priya Shah), the templates and the letter styles. The offers list starts empty on purpose. Create an offer and it shows up.

## The promo page

The promo lives at http://localhost:5173/promo/. It's plain HTML, CSS and JS in `public/promo/`, so there's nothing to build. Edit a file, refresh, done.

## Starting over

Want the offers list back to empty? Delete the offers from the app, or just delete `data/bolto.db` while the dev server is stopped. It gets rebuilt and re-seeded next time you run it.

## Other commands

- `npm run build` checks the types and builds the site into `dist/`
- `npm run preview` serves that build locally, so you can see what gets hosted
- `npm run typecheck` just checks the types

## How it saves

Locally, offers are saved in that SQLite database, so they stick around between runs.

On a hosted build there's no server, so offers are saved in each visitor's own browser instead. Everyone gets their own copy, and clearing site data wipes it. Want to try that version locally? Run `VITE_BROWSER_STORAGE=true npm run dev` (on Windows PowerShell: `$env:VITE_BROWSER_STORAGE='true'; npm run dev`).

## Where things are

- `src/` is the app (React, TypeScript, CSS Modules)
- `tokens.json` is the design tokens, and the source of truth for colours, spacing and type
- `server/` is the local database and its `/api`
- `public/promo/` is the promo page
