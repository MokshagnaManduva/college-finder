# College Finder frontend

React/Vite application with the redesigned discovery and decision workspace. HTTP development
uses FastAPI through the `/api` proxy; a file-based standalone build uses labelled demo fixtures.

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
npm run build:preview
```

Start the API on port 8000 before using the connected app at http://localhost:5173.
Optional Vite configuration is documented in `.env.example`; `VITE_DATA_MODE=demo` enables a
fixture-only development session. The standalone build at `../preview/college-finder.html`
supports guest browsing and notes. Transfer those notes using JSON Export backup / Import backup
in My workspace before signing in to the connected application.

See [the project README](../README.md) for setup, account sync, verification and limitations.
