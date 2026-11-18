# Hostel Care UX Contract

## Product context

- **Audience:** Hostel students, wardens, and maintenance staff.
- **Primary jobs:** Submit and track a complaint; review, prioritize, assign, and report; update assigned work and resolve it.
- **Market and locale:** Single hostel at Siddaganga Institute of Technology; English UI, browser-local date/time with `en-IN` formatting where specified.
- **Accessibility target:** WCAG 2.2 AA baseline.

## Business context sources

| Scope | Authority | Source |
|---|---|---|
| Complaint lifecycle, roles, priorities, 48-hour overdue rule | Supplied SRS v1.0 | Hostel Complaint Management System SRS |
| Request validation, authorization, persistence | API implementation | `server/src/index.js`, `server/db/init.sql` |

## Visual contract

- **Design source:** `DESIGN.md`.
- **Token owner:** Runtime CSS in `client/src/glass-theme.css`; `DESIGN.md` mirrors those semantic tokens.
- **Theme:** Navy glass surfaces with royal-blue primary actions and restrained teal accents. Layout and workflows remain unchanged.
- **Mapping:** `:root` semantic custom properties → shared application classes from `client/src/styles.css` and `client/src/design-polish.css`, finalized by `client/src/glass-theme.css`. Reduced transparency uses opaque navy surfaces.

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native HTML select | Browser platform | Native popup accepted for internal workflow | Keyboard and selected value |
| Form | Shared app form styles and native controls | API validation + component state | Create / update | Error, pending, success |
| Scrollbar | Global app stylesheet | `DESIGN.md` | Same global palette | Desktop and drawer |
| Toast | App-level toast in `App` | Shared semantic tone classes | Success / error | Live-region announcement |
| CRUD | Complaint list/detail/create flows | SRS and Express API | Create returns to list; updates remain in detail | Full browser workflow |

## Workflow and state

- **Create complaint:** Student submits from dashboard or complaint list; pending label remains stable; success returns to complaint list with confirmation; failure retains entered values and shows an actionable error.
- **Review/update:** Warden changes priority, assignment, or status in the complaint detail drawer; success refreshes the list and detail; failures preserve the current complaint state.
- **Staff progress:** Assigned staff can mark work In Progress or Resolved and add remarks; status is recorded in the history.
- **Feedback/reopen:** A student can leave feedback after resolution and request reopening of their own resolved complaint.
- **Notifications:** Users see their own notification history; unread state is marked read through an explicit action.
- **Search/filter:** Search and status filter apply to the current loaded list; changing a filter must not leave a stale selection.
- **Overdue:** A complaint is overdue after 48 hours unclosed; the warden dashboard and complaint detail make this visible.

## Navigation and responsive behavior

- Persistent desktop navigation becomes an off-canvas mobile drawer.
- Current page is named in the breadcrumb and page heading.
- Complaint list uses document scrolling; no virtualized or paginated API is currently implemented.
- Complaint details use a right-side sheet, full-width on narrow screens.
- Text remains available without hover; titles may truncate only where the detail view retains the full value.

## Feedback, errors, and async

- Mutations use pending state and a success/error toast. Do not clear form content on failure.
- Notifications and errors use accessible live regions.
- Session expiry returns to sign-in with an inline explanation.
- No draft persistence, offline write queue, or conflict recovery is currently implemented.
- Modal/sheet Escape and focus restoration are expected; do not block UI polish on unimplemented auth/backend workflows.

## Permissions

- Hide navigation sections that are irrelevant to the active role.
- The server remains the authority for role and record access; client visibility is not a security boundary.
- Students see only their own complaints; staff see only assigned complaints; wardens manage all complaints.

## Verification

- `npm run build` in `client`.
- Run `scripts/audit_project.py` from the installed Frontend Design Premium skill against this project.
- Inspect sign-in, list, dashboard, detail, and form at desktop and phone widths; review keyboard focus, empty/loading/error feedback, and reduced motion.
