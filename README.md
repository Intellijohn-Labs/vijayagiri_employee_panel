# Vijayagiri Ops Hub

Branch network portal for Vijayagiri Motors / Auto Agencies — an authorized Yamaha dealership with one Head Office
(central yard) and five sub-branch showrooms in Ernakulam.
Next.js (App Router) · Tailwind CSS 3 · Framer Motion · Lucide · Zustand.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Routes

| Route | What it does |
| --- | --- |
| `/` | Redirects to `/branches` |
| `/branches` | The six branch cards: status badge, address, contact, manager, **View Branch Details** drawer, call and directions links. The top-bar branch switcher shows all branches or just one |
| `/stock` | **All Stock**: network totals, six showroom cards, a filterable stock table and a model × branch matrix. Optional sample data |
| `/stock/<showroom>` | One page per showroom (e.g. `/stock/perumbavoor`): stock grouped by model with colour breakdowns, status mix, and an expandable VIN / chassis list with book / transfer / deliver / receive actions |
| `/stock/add` | **Add Stock**: pick one of the six showrooms, then enter Yamaha vehicle intake (model, variant, colour, frame/VIN and engine number per unit, quantity, status, reference prices, intake date). Entries persist in `localStorage` and show under *Recently added* |
| `/login` | Sign-in screen with a typing-reactive tachometer. Only employees an Admin has added in `/employees` can sign in; an invited employee first uses "Activate your account" to verify their email and set a password. Demo only — passwords are salted SHA-256 hashes in browser storage, with no server behind them. Demo accounts use `demo@1234`; Divya Kamath is left un-activated to try the invite flow |
| `/employees` | Admin-only employee directory: ID cards, add/edit, showroom access, activate/deactivate |
| `/catalogue/manage` | Admin-only Catalogue Manager: per-model photo gallery (tagged by colour), specs, features, pricing/EMI defaults and brochure PDF. Photos and PDFs are kept in IndexedDB, text in `vg.catalogue` |
| `/catalogue/explore` | Full-screen Customer Showcase for tablets and showroom screens: category tabs, colour swatches with live stock, EMI calculator, test-ride request, printable quotation, cross-branch yard check |
| `/insurance` | Insurance Hub: customer policies by status (Active, Expiring Soon, Pending Issuance), filters by showroom, policy PDFs and WhatsApp renewal reminders. Visible to all staff, limited to the showrooms they can open |
| `/settings` | Admin-only Settings: dealership profile and hours, finance and EMI defaults, showcase preferences, security, appearance and sound. Stored in `vg.settings` and applied across the app |

There is a single role: **Admin**. Every session is an Admin session.

## Structure

- `src/lib` — branch data and helpers (`branches.ts`), the Admin user (`users.ts`), motion presets, small utilities
- `src/store` — Zustand stores: `app-store` (branch scope, sidebar), `toast-store`, `theme-store`
- `src/components/ui` — design-system primitives (button, popover/select, drawer, toaster…)
- `src/components/shell` — sidebar, top bar, branch switcher, app shell
- `src/components/auth` — shared pieces for the sign-in screen (racing background, form fields, tachometer loader)

Design tokens live in `src/app/globals.css` (CSS variables per theme: Yamaha Racing Blue & White, with a dark mode) and are
mapped in `tailwind.config.ts`. The "Revs Your Heart" watermark sits behind the page content (`public/images`).

## Notes

- Branch phone numbers containing `x` are placeholders; the Call button is disabled until a real number is added in
  `src/lib/branches.ts` (`dial`).
- Opening hours (9 AM – 7 PM) are shared by all branches and drive the Open / Closed badge.
- Only the theme, the sidebar state and the selected branch persist to `localStorage`.

## Official Yamaha photos

No Yamaha photography is bundled. To show official studio photos in the catalogue, stock thumbnails and showcase, put licensed files in `public/images/catalogue/` and list them in `public/images/catalogue/manifest.json` by model id and colour (see the note at the top of that file). Photos uploaded in the Catalogue Manager take priority.
