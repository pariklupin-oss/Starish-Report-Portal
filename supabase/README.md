# Supabase migration — isolated staging

This branch is a migration prototype. It is **not connected to the live portal** and has not changed the production branch or Google Sheets. It must be tested in a separate Supabase project before any production cutover.

## Current state and required inputs

The portal currently uses a Google Sheets / Apps Script backend. This repository does not contain a Supabase project URL, credentials, source workbook exports, or a verified mapping of every sheet's columns and formulas. Therefore no real employee/report rows have been migrated and no zero-problem guarantee is possible yet.

To run a faithful staging migration, prepare:
1. A new, empty Supabase project for testing. Do not use the production project for this first pass.
2. CSV export of every relevant tab, including user/employee master list, all production report tabs, task master/assignment/status data, maintenance complaints, and maintenance work logs/timesheets. Keep an untouched backup copy.
3. A field mapping for each source tab. Preserve source sheet name, original row key/ID, formulas/calculated values, and date/time timezone.
4. A list of test logins/roles for owner, manager, employee, maintenance head, and maintenance employee.

Never send a Supabase secret/service-role key in chat or put one in browser code or Git. Use the publishable key in the browser only with RLS enabled. Any one-time import requiring elevated access must run in a trusted local/server environment.

## Staging setup

1. Create a **separate** Supabase project and confirm its project name says staging/test.
2. Open SQL Editor and run [schema.sql](./schema.sql).
3. Create test Auth users in Supabase Authentication. Then insert matching rows into `public.users` using each Auth user's UUID. Set their role from trusted SQL/admin tooling. Do not accept a role from user-editable signup metadata.
4. From **Project Settings → API**, copy the project URL and publishable/anon key into a local ignored `.env` file:
   ```env
   VITE_SUPABASE_URL=https://YOUR-STAGING-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_STAGING_PUBLISHABLE_KEY
   ```
5. Install `@supabase/supabase-js` in a separate test build and use [examples/client.js](./examples/client.js). This branch does not switch or replace the deployed app.

## Export and load sheet data

1. In Google Sheets, make a copy/backup of the workbook. For each data tab use **File → Download → Comma-separated values (.csv)**. CSV exports only the currently selected tab, so repeat for each tab.
2. Record row counts, min/max dates, and important totals before importing (production quantity/meters, task status counts, complaint counts, timesheet hours).
3. Map sheet headers to destination columns. Use `production_reports.payload` JSONB to preserve source-specific columns while common fields go to `module`, `report_date`, `shift`, and `machine_name`. Keep source identifiers in `source_sheet` and `source_row_key`. Convert spreadsheet date serials/timezones explicitly.
4. Import employees into Supabase Auth first, then `users`; map every employee/assignee to the corresponding Auth UUID. Never migrate plaintext passwords. Issue password resets/invitations or use the agreed secure sign-in flow.
5. Import tasks, production reports, complaints, and maintenance work logs. In Dashboard, open the destination table → **Import data from CSV**. Import related parent rows before child rows so foreign keys resolve. The dashboard CSV flow has size limits; for larger files use a reviewed, repeatable server-side importer.
6. Do not mark imported rows approved/completed unless the source explicitly says so. Keep original source status and row IDs in the migration mapping/audit record.

## Acceptance checks before any cutover

Compare source and staging for **every tab**, not just a sample:
- Source vs destination row counts, date ranges, distinct employee/machine names, nulls, duplicate IDs, and all report totals/calculated KPIs.
- Task visibility: one employee sees only their assigned tasks; a manager sees the intended team scope; owner sees all.
- Complaint lifecycle: operator can submit; maintenance head can assign; assignee sees the full complaint and can complete/hold with a reason; owner/manager can see progress and work-hour logs.
- Production reports: each module/date/shift matches source, including edge cases such as zero rows and recently updated entries.
- Test mobile/desktop views, sign-in, refresh, slow network, exports/PDF, and existing portal actions.
- Verify no browser request contains a service-role/secret key. Verify unauthorized cross-employee reads/updates are rejected by RLS.

A migration is not validated until these checks pass and the business owner signs off on the reconciled totals.

## Production cutover and rollback

Only after staging passes:
1. Take a fresh Google Sheets/Apps Script backup and stop writes for a short maintenance window (or design and test dual-write first).
2. Import the final delta, reconcile counts/totals again, then deploy a separately reviewed production configuration.
3. Keep the old portal and source sheets read-only for a rollback period. Roll back by restoring the previous app deployment and resuming the Sheets backend; do not delete the original data during migration.
4. Switch traffic only after sign-in and critical report/task/complaint tests pass against production.

## Schema notes

- `users.id` is the Supabase Auth UUID; role is assigned by a trusted administrator. Passwords are not stored in `users`.
- `tasks` stores one assignee per row. Multiple employees on the same shift task share `task_group_id`.
- `production_reports.payload` preserves report-specific sheet columns as JSONB until actual headers and KPI calculations have been verified.
- `maintenance_work_logs` stores start/end events so assigned maintenance work hours can be calculated and audited.
- The initial RLS policies are a test baseline; review exact production role scopes and approval workflow before cutover.
