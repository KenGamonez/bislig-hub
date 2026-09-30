# Driver UI/UX Protection Contract

## Overview
This contract separates the **Driver Presentation Layer** from all protected systems. Every phase of the Driver UI/UX overhaul must respect these boundaries.

---

## PROTECTED SYSTEMS — NEVER MODIFY

### Authentication & Authorization
- `src/legacy/lib/driverAuth.ts` — sign-in, password reset, session
- `src/legacy/lib/supabase.ts` — Supabase client
- `src/lib/supabase.ts` — Hub Supabase client
- `src/driver/hooks/useDriverSession.ts` — driver session hook
- `src/org/useOrgAdmin.ts` — admin session (shared identity model)
- Organization membership gate (`organization_members`, `organization_admins`)
- BTRP TODA organization ID: `db6648d8-ae1b-4813-a573-0e4f6cdbeacd`

### Transport Business Logic (Ride Now / Pakyawan / Pa-deliver)
- `src/legacy/lib/dispatch.ts` — ride offers, accept/decline
- `src/legacy/lib/rides.ts` — ride state machine, status updates
- `src/legacy/lib/scheduledBookings.ts` — Pakyawan bookings/offers
- `src/legacy/lib/deliveries.ts` — delivery bookings/offers
- `src/legacy/lib/rideLocation.ts` — GPS tracking
- `src/legacy/lib/driverPresence.ts` — online/available/auto-accept
- All RPCs: `set_driver_presence`, `accept_ride_offer`, `update_ride_status`, etc.
- Realtime subscriptions for offers, assigned rides, cancellations

### Database Schema & RLS
- Tables: `drivers`, `rides`, `ride_messages`, `pakyawan_bookings`, `pakyawan_offers`, `deliveries`, `delivery_offers`, `delivery_messages`, `btrp_chat_messages`, `driver_locations`, `organization_members`, `organization_admins`
- RLS policies on all tables above
- pg_cron cleanup for `btrp_chat_messages` (24-hour expiry)

### Admin UI (LOCKED — Phase 2 complete)
- `src/org/OrgShell.tsx`, `src/org/OrgGuard.tsx`, `src/org/useOrgAdmin.ts`, `src/org/orgData.ts`
- `src/org/pages/OrgDashboard.tsx`, `OrgDrivers.tsx`, `OrgActivity.tsx`, `OrgAnnouncements.tsx`, `OrgChat.tsx`, `OrgForum.tsx`, `OrgTopic.tsx`, `OrgSettings.tsx`
- `src/org/org-premium.css` (Admin design system)
- `src/org/OrgConfirm.tsx`

### Founder Admin
- Any founder-only routes/guards

### Other Repositories
- `C:\Users\Maiev\Desktop\bislig-ride` — MUST NOT TOUCH

---

## DRIVER PRESENTATION LAYER — SCOPE OF OVERHAUL

### Routes (App.tsx)
| Route | Page | Shell |
|-------|------|-------|
| `/driver/login` | Legacy `Driver` (wraps `DriverLogin`) | LegacyShell |
| `/driver` → `/driver/home` | `HomePage` | `DriverShell` |
| `/driver/jobs` | `JobsPage` | `DriverShell` |
| `/driver/active` | `ActiveJobPage` | `DriverShell` |
| `/driver/you` | `YouPage` | `DriverShell` |
| `/driver/history` | `DriverHistoryPage` | `DriverShell` |
| `/driver/news` | `NewsPage` | `DriverShell` |
| `/driver/chat` | `ChatPage` (uses shared `ChatRoom`) | `DriverShell` |
| `/driver/welcome` | `MustChangePasswordPage` | `DriverShell` |

### Driver Shell & Chrome
- `src/driver/DriverShell.tsx` — header, main canvas, bottom nav
- `src/driver/components/DriverHeader.tsx` — brand, driver name, online dot, language toggle
- `src/driver/components/DriverBottomNav.tsx` — 3-tab bottom nav (Home, Jobs, You)
- `src/driver/components/DriverHamburger.tsx` — slide-over drawer menu
- `src/driver/hooks/useDriverPresenceContext.tsx` — online/available state

### Driver Pages (src/driver/pages/)
| Page | Purpose |
|------|---------|
| `HomePage.tsx` | Greeting, status pills, current job quick link, latest news, quick actions |
| `JobsPage.tsx` | Presence toggle, active job link, push control, incoming job cards |
| `ActiveJobPage.tsx` | Ride/Pakyawan/Delivery active views, journey steps, route, customer, map, GPS, actions, chat, rating |
| `NewsPage.tsx` | Published BTRP announcements list |
| `ChatPage.tsx` | Shared `ChatRoom` for driver's organization |
| `YouPage.tsx` | Identity, stats, vehicle, photo, account actions, push control, history link |
| `DriverHistoryPage.tsx` | Combined rides + deliveries history list |
| `MustChangePasswordPage.tsx` | First-login password replacement gate |

### Driver Components (src/driver/components/)
**Active Job:** `ActiveJobActions`, `ActiveJobCancel`, `ActiveJobCustomer`, `ActiveJobHeader`, `ActiveJobRoute`, `DeliveryActiveView`, `PakyawanActiveView`, `JourneySteps`, `RideChat` (legacy)
**Job Cards:** `JobCard`, `JobCountdown`, `JobTypeBadge`, `PriceProposalCard`
**Profile/Account:** `DriverIdentityCard`, `DriverAccountActions`, `DriverPhotoControl`, `DriverStats`, `DriverVehicleCard`, `DriverPushControl`
**UI Primitives:** `DriverPage`, `EmptyState`, `LoadingState`, `StatusPill`, `DriverMap`, `GpsStatus`, `RatingForm`
**Navigation:** `DriverHeader`, `DriverBottomNav`, `DriverHamburger`

### Driver Hooks (src/driver/hooks/)
- `useActiveJob.ts` — active ride/pakyawan/delivery polling
- `useDriverJobs.ts` — incoming offers, assigned rides, pakyawan, deliveries
- `useDriverHistory.ts` — ride + delivery history
- `useDriverPresence.ts` — online/offline toggle
- `useDriverPresenceContext.tsx` — presence provider + context
- `useDriverReputation.ts` — completed rides, rating, cancellations
- `useDriverSession.ts` — driver auth session
- `useDriverGps.ts` — GPS tracking during active ride
- `useRideChatUnread.ts` — ride chat unread count

### Driver CSS
- `src/driver/driver.css` — **26KB, all scoped under `.hub-driver`** (safe, no leakage)
- Uses Hub design tokens: `--bg-page`, `--brand-slate-deep`, `--brand-orange`, `--text-*`, `--border*`, `--radius-*`, `--shadow-*`, `--touch-min` (44px), `--touch-comfort` (48px), `--header-height`, `--bottom-nav-height-safe`, `--container-max`, `--container-max-desktop`, `--content-padding`

### Shared with Admin (READ-ONLY for Driver)
- `src/components/ChatRoom.tsx` + `chatroom.css` — **shared BTRP chatroom** (driver `isAdmin={false}`, admin `isAdmin={true}`)
- `src/org/orgData.ts` — `fetchMyMemberships`, `fetchPublishedAnnouncementsForMember`, `fetchOrganization`, `fetchChatMessages`, `sendChatMessage`, `deleteChatMessage`
- `src/legacy/lib/driverAuth.ts` — `changeDriverPassword` (used by `MustChangePasswordPage`)

---

## HIGH-RISK SHARED FILES — SCOPE CAREFULLY

| File | Used By | Risk | Mitigation |
|------|---------|------|------------|
| `ChatRoom.tsx` | Driver ChatPage, Admin OrgChat | High | Never modify shared logic; only pass different `isAdmin` prop. CSS in `chatroom.css` is shared — scope any driver-specific tweaks via parent class (`.hub-driver .btrp-chat`) |
| `orgData.ts` | Driver pages, Admin pages | Medium | Driver uses read-only queries; don't modify RPC signatures |
| `driverAuth.ts` | Driver login, MustChangePasswordPage | Medium | Only used for `changeDriverPassword`; don't touch sign-in logic |
| `supabase` clients | All | Critical | Never replace or reconfigure |

---

## CSS FIREWALL RULES

1. **All new driver CSS must be scoped under `.hub-driver`** (already the case for `driver.css`)
2. **Never create broad selectors**: `button`, `input`, `table`, `header`, `nav`, `main`, `body`, `.card`, `.panel`, `.btn` — these leak into Admin/customer UI
3. **Driver-specific classes**: prefix with `hub-driver__` or `driver-`
4. **ChatRoom CSS**: `chatroom.css` uses `.btrp-chat` — if driver needs adjustments, scope via `.hub-driver .btrp-chat` in `driver.css`
5. **Legacy CSS**: `ride-legacy.css` — never modify for driver overhaul
6. **Admin CSS**: `org-premium.css` — NEVER TOUCH (Admin is locked)

---

## VALIDATION CHECKLIST PER PHASE

Before commit in every phase:
- [ ] `git status --short` — only intended files modified
- [ ] `npm run guardrails` — PASS (no protected files touched)
- [ ] `npx tsc --noEmit` — PASS
- [ ] `npm run lint` — PASS (0 warnings, 0 errors)
- [ ] `npm run build` — PASS
- [ ] `git diff --check` — PASS
- [ ] Production deploy to `bislig-hub-app` via `vercel deploy --prod --yes --archive=tgz`
- [ ] Route verification: all driver routes + admin routes return 200

---

## PHASE EXECUTION ORDER

1. **Phase 0** — Discovery + Protection Contract (this document) ✓
2. **Phase A** — Driver Design Foundation (design tokens, primitives, typography, spacing)
3. **Phase B** — Driver Home/Dashboard (HomePage)
4. **Phase C** — Driver Jobs/Work Workspace (JobsPage, JobCard, push control)
5. **Phase D** — Active Ride/State Experience (ActiveJobPage, sub-components)
6. **Phase E** — Announcements/News (NewsPage)
7. **Phase F** — BTRP Shared Chat (ChatPage, ChatRoom polish)
8. **Phase G** — Profile/Account (YouPage, sub-components)
9. **Phase H** — Driver Login (new premium login page replacing legacy)
10. **Phase I** — Final Responsive QA (375/390/430/768/1024/1280/1440/1920)

---

## DEPLOYMENT PROTOCOL

- **Vercel Project**: `bislig-hub-app` (Production: `https://bislig-hub-app.vercel.app`)
- **CLI Deploy**: `vercel deploy --prod --yes --archive=tgz` (GitHub auto-deploy unreliable)
- **Project Link**: Temporarily link to `bislig-hub-app`, deploy, restore `.vercel/project.json`
- **Old Project**: `bislig-hub` — NEVER DEPLOY TO

---

## CURRENT BASELINE
- **HEAD**: `2a237b3` (Admin desktop composition fix)
- **Branch**: `master`
- **Admin UI**: LOCKED — `2a237b3` is the protected baseline
- **Working Tree**: Clean except known untracked files

---

*Generated during Phase 0 Discovery. This contract governs all subsequent Driver UI/UX phases.*