# Smart Energy Meter Frontend

React + Vite frontend for the Smart Energy Meter platform.
It provides:

- Public landing page
- User auth and dashboard
- Usage analytics (daily, hourly, live)
- Bill viewing and payment flow
- Admin login and admin operations pages

## Tech stack

- React 18
- TypeScript
- Vite 5
- Tailwind CSS
- shadcn/ui
- Recharts

## Prerequisites

- Node.js 18+
- npm 9+

## Local setup

From this folder:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open: http://localhost:8080

## Environment variables

The template file is .env.example.

- VITE_API_BASE: API base path used by frontend client. Default: /api/v1
- VITE_DEV_HOST: Vite host. Default: ::
- VITE_DEV_PORT: Vite port. Default: 8080
- VITE_API_PROXY_TARGET: Dev proxy target for /api requests. Default: http://localhost:8000

For local backend integration, keep:

- VITE_API_BASE=/api/v1
- VITE_API_PROXY_TARGET=http://localhost:8000

## Run with backend

1. Start backend API on port 8000.
2. Start frontend on port 8080.
3. Frontend calls to /api/* are proxied to backend in dev mode.

## Scripts

- npm run dev: Start Vite dev server
- npm run build: Production build
- npm run build:dev: Development-mode build
- npm run preview: Preview built app
- npm run lint: Run ESLint

## Project structure

- src/pages: Route pages
- src/components: Reusable UI and layout components
- src/lib/api.ts: Auth token handling and API wrapper
- public/favicon.svg: Project favicon

## Branding notes

- App title and social meta are defined in index.html.
- Favicon is served from /favicon.svg.
- Product name in UI is Smart Energy Meter.
