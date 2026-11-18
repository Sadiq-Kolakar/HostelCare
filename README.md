# Hostel Complaint Management System

A single-hostel complaint workflow built with React, Express, PostgreSQL, and Docker Compose.

## Run locally

1. Copy `.env.example` to `.env` and replace all example values. Use a `JWT_SECRET` of at least 32 characters and a `WARDEN_PASSWORD` of at least 12 characters.
2. Run `docker compose up --build`.
3. Open http://localhost:5173. The API is at http://localhost:4000/api.

## Run on Windows without Docker

1. Start the PostgreSQL Windows service. In pgAdmin, create a login role named `hcms` and a database named `hcms` owned by that role.
2. For a new database only, connect to `hcms` in pgAdmin, open Query Tool, load `server/db/init.sql`, and execute it. If your existing HCMS database is already initialized, skip this step.
3. Still in Query Tool, open and execute `server/db/migrations/002_complaint_votes.sql` once. This adds the complaint voting table to the existing database.
4. In a PowerShell terminal, install the API packages and set the connection and secrets (use the same database password you chose in pgAdmin):

   ```powershell
   cd server
   npm install
   $env:DATABASE_URL = "postgres://hcms:your-local-password@localhost:5432/hcms"
   $env:JWT_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   $env:WARDEN_PASSWORD = "Choose-A-Password-12+"
   npm run dev
   ```

5. In a second PowerShell terminal:

   ```powershell
   cd client
   npm run dev
   ```

6. Open http://localhost:5173. Sign in as `warden@hcms.local` using the `WARDEN_PASSWORD` from step 4. Students can register in the app.

PostgreSQL initializes from `server/db/init.sql`. The initial warden is `warden@hcms.local`; set its password through `WARDEN_PASSWORD`. Students can register from the UI. Wardens can create staff accounts and manage all complaints.

## Current scope

- Role-based student, warden, and maintenance staff accounts.
- Complaint submission, categories, priority, assignment, status transitions, remarks, history, reopening, feedback, and in-app notifications.
- Student community complaint board with private-data-safe issue cards, category/status filters, popularity and date sorting, and unique student upvotes. Wardens see vote totals alongside existing severity and assignment information.
- Overdue identification after 48 hours, based on the complaint submission timestamp.
- Responsive dashboards with complaint filtering and basic statistics.

Images are represented in this first iteration by an optional attachment URL. The student community board does not expose those attachments.

The API integration tests require the local API to be running with the configured `.env`; run `npm test` from `server`. The client production bundle can be checked with `npm run build` from `client`. Configure production secrets and HTTPS before deployment.

## Git branching workflow

- `main` is the stable, production-ready branch.
- `develop` is the integration branch; completed work is merged here before release to `main`.
- Create short-lived branches from `develop` using `feature/feature-name` for features, `fix/bug-name` for bug fixes, and `docs/documentation-name` for documentation changes. Merge finished branches back into `develop` through review; merge a release from `develop` into `main` when it is ready.
