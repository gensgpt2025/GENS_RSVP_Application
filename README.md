# GENS Schedule

Private schedule and RSVP management app for pre-registered members.

## Features

- Organization-code login with member selection
- Member registration from inside each organization
- Event creation, editing, and deletion from inside each organization
- RSVP responses: attending, declined, maybe
- Google Calendar link and `.ics` export
- App-only event and member management, without spreadsheet sync
- Site-admin-only organization management, organization-code changes, backup, and restore
- Private automatic backups on the 5th, 15th, and 25th with 35-day retention on Vercel Blob
- Persistent storage with Neon Postgres on Vercel

## Environment Variables

Set these variables on Vercel or in the distribution `.env` file. `DATABASE_URL` is preferred. `POSTGRES_URL` also works.

Use a new database for this app. Do not reuse the existing `GENS_RSVP` database connection string.

```env
DATABASE_URL="postgres://user:password@host/gens_schedule_distribution?sslmode=require"
SITE_ADMIN_USERNAME="sugaya"
SITE_ADMIN_PASSWORD="change-this-site-admin-password"
ORGANIZATION_NAME="GENS"
ORGANIZATION_CODE="GENS"
CRON_SECRET="replace-with-a-long-random-secret"
BLOB_READ_WRITE_TOKEN="provided-automatically-by-vercel"
```

The app creates its tables automatically on first access. `ORGANIZATION_NAME` and `ORGANIZATION_CODE` create the first organization and an initial selectable member.

Login stays lightweight: users enter an organization code and select their member name. Organization management, organization-code changes, backup, and restore require the site admin credentials. The default site admin username is `sugaya`; set `SITE_ADMIN_PASSWORD` on Vercel.

## Automatic Backup on Vercel

1. Open the Vercel project and select `Storage`.
2. Create a Blob store with access set to `Private`, then connect it to this project.
3. Confirm that Vercel added `BLOB_READ_WRITE_TOKEN` to the project environment variables.
4. Add `CRON_SECRET` to Production with a random value of at least 16 characters.
5. Redeploy the production deployment.
6. Open `Settings` > `Cron Jobs` and confirm `/api/cron/automatic-backup` is registered.

The Cron Job runs on the 5th, 15th, and 25th of each month at approximately 03:00-03:59 Japan time. It stores one JSON file per organization under `automatic-backups/YYYY-MM-DD/`. Files older than 35 days are deleted after a successful backup. The files are private and are not accessible from a public Blob URL.

## Permissions

- Site admin: create and delete organizations; change organization codes; back up and restore organization data
- Organization members: view, create, edit, and delete events; add and delete members; answer RSVP

Organization data is scoped by `organization_id`, so members, events, RSVPs, ICS downloads, calendar views, history, backup, and restore are limited to the logged-in organization.

## Development

```bash
npm install
npm run dev
```

## Distribution Build

Create a self-contained production folder:

```bash
npm run dist
```

The app is written to `dist/gens-schedule`. Copy `.env.example` to `.env` in that folder, set the real environment variables, then start it:

```bash
node server.js
```

By default it runs on `http://localhost:3000`. Set `PORT` to use another port, or `HOSTNAME=0.0.0.0` to allow access from another device on the same network.

For production use, connect a separate Neon Postgres database in Vercel and deploy from `https://github.com/gensgpt2025/GENS_RSVP_Application.git`.
