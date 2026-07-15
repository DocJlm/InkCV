# InkCV Web

The Web application uses Vite with Nitro. In Vercel, set the project Root
Directory to `apps/web` and keep **Include files outside the root directory in
the Build Step** enabled so workspace packages remain available.

From the repository root:

```bash
pnpm dev
pnpm --filter @inkcv/web build
```

The same Nitro route serves `POST /api/ai/chat` locally and as a stateless
Vercel Function in production.
