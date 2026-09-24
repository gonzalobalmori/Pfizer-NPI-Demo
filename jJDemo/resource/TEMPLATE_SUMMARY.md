# Blank Package — Template Initial State

This summary describes the **initial state** of a workspace created from the `blankPkg`
template, before any user changes, **and embeds the key patterns** (backend calls, route/nav
wiring, which example to copy) you would otherwise open files to learn.

**Treat this summary as sufficient to start building.** Do not open the template files listed
below just to orient yourself or "see what's there" — the structure and the patterns you need
are here. Only open a specific file when you are about to **modify it**, or when you need an
exact detail this summary genuinely does not contain (then read just that file).

> The package directory and its `*.c3pkg.json` are renamed to your package name at creation
> time. Paths below use `<pkg>` to mean that package folder.

## What's scaffolded vs empty

- **Backend (`<pkg>/src/`): does not exist yet.** The template has **no top-level `src/`** (the only
  `src/` is `ui/react/src/`). Create `<pkg>/src/` for the domain entities (`.c3typ`) and
  implementations you add.
- **Frontend (`<pkg>/ui/react/`): fully wired React + Vite + TypeScript + Tailwind shell** with
  no application pages — `<Routes>` contains only a catch-all `path="*"` fallback and there is a
  single "Demo" nav item.
- **No `seed/`, `data/`, `config/`, `metadata/`, `test/`, or `gen/`** directories exist yet;
  create them as needed following the standard C3 package structure.

## Package root

- `<pkg>.c3pkg.json` — manifest. Declares the package dependencies (e.g. `mcpServer`); check the
  file for exact versions. `author`/`description` are
  filled in at creation; `name` is your package name. Do not change the package name.

## Frontend layout (`<pkg>/ui/react/`)

Tooling: Vite + React 18 + TypeScript + Tailwind v4, Radix UI, TanStack Table/Query, Recharts/
ECharts, Leaflet, react-router-dom, axios, i18next. Scripts: `dev`, `build`, `test`
(`jest --passWithNoTests`), `lint`. Config files: `vite.config.mts`, `tsconfig*.json`,
`eslint.config.js`, `jest.config.ts` / `jest.setup.ts`, `components.json`, `.npmrc`.

`src/` structure:

| Path | Contents |
| --- | --- |
| `main.tsx` | Mounts `<App/>` inside a `HashRouter`. |
| `App.tsx` | App shell: `SideNav` + a `<Routes>` that has only a catch-all `path="*"` fallback route (add application routes alongside it — see "Add a page" below). |
| `c3Action.ts` | Backend client (API surface below). |
| `config/navigation.ts` | Nav config: one "Demo" item (`/`) plus `addNavigationItem` / `removeNavigationItem` / `updateNavigationBadge` helpers. |
| `components/` | `SideNav`, `TopNav`, `ErrorBoundary`, `LoadingStates/` skeletons. |
| `components/ui/` | shadcn-style primitives: `button`, `checkbox`, `collapsible`, `data-table`, `dialog`, `input`, `select`, `skeleton`, `table`, `tabs`, `textarea`. |
| `contexts/` | `AppStateProvider`, `ReportStateProvider`. |
| `hooks/` | `useTheme`, `useEffectExceptOnMount`. |
| `clientProvider/` | axios configuration. |
| `c3ui/`, `tailwind/`, `globals.css` | C3 design-system tokens (foundation + light/dark semantic) and Tailwind theme/utilities/vendor overrides. |
| `lib/utils.ts`, `types/`, `assets/`, `data/sampleData.ts` | Utilities, types, static assets, placeholder sample data. |
| `shared/api.ts` | Example `c3Action`-backed API helpers (`fetchUsers`/`fetchUserGroups` against `User`/`UserGroup`) — real backend calls, not placeholder data. |

`public/` holds fonts (Inter, FontAwesome, Kendo icons). `index.html` is required for the
build — if it goes missing, copy it from an example and/or run `npm run build`.

## Backend calls — `c3Action.ts` API (you do NOT need to open this file)

All exported from `@/c3Action` (or `./c3Action`). Each returns `Promise<any>` and posts to
`<appBaseUrl>/api/8/<TypeName>/<action>`:

- `c3Action(typeName, actionName, spec?)` — general call. For **fetch**, `actionName='fetch'` and
  `spec` is a Filter/FetchSpec object. For other actions, `spec` is an **array of args**.
- `c3CreateAction(typeName, actionName, spec)` — create/merge; `spec` is the object to persist.
- `c3MemberAction(typeName, actionName, instance, spec?)` — call a member function on `instance`.
- `c3GetAction(typeName, id, include='id')` — convenience get-by-id.

Typical fetch:

```ts
import { c3Action } from '@/c3Action';

const res = await c3Action('Vehicle', 'fetch', { include: 'this', limit: -1 });
const vehicles = res.objs ?? [];
```

## Add a page (route + nav) — the wiring you'd otherwise read `App.tsx`/`navigation.ts` to learn

1. In `src/App.tsx`, add a route inside `<Routes>` (the file already imports both `Route` and
   `Routes`, so no import change is needed):

```tsx
import FleetPage from './pages/FleetPage';
// ...
<Routes>
  <Route path="/fleet" element={<FleetPage />} />
  {/* the existing catch-all <Route path="*" .../> stays */}
</Routes>
```

2. In `src/config/navigation.ts`, add an item to `navigationConfig` (icon is a `lucide-react`
   component); `path` must match the route:

```ts
import { Car } from 'lucide-react';

{ id: 'fleet', path: '/fleet', icon: Car, iconActive: Car, label: 'Fleet', tooltip: 'Fleet overview' }
```

## Reference library — `<pkg>/ui/react/resources/examples/`

Copy from here when building UI (don't reinvent). **Which to copy:**

- A dashboard / table page (counts + a data grid): copy `pages/OverviewPage` or
  `pages/DashboardPage`; use `components/ui/data-table.tsx` (TanStack) for the grid.
- Lists with filters: `pages/AnalyticsPage`, `components/FilterSection`.
- Other components available: `Map`, `Modal`, `NetworkGraph`, `Alert`, `Document`,
  `OptionSelect`, `SideNav`, `TopNav`, `SkeletonLoader`. `demo/c3-design-system.html` shows the
  design system. See `resources/examples/README.md` for the full index.

Import alias `@/` maps to `src/`. Example pages live under `resources/examples/` and are **not**
routed by default — copy the ones you need into `src/pages/` and wire them as above.

