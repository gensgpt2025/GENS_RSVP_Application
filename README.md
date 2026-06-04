# GENS Schedule

Private schedule and RSVP management app for pre-registered members.

## Features

- Member-only login
- Admin-only member registration
- Admin-only event creation
- RSVP responses: attending, declined, maybe
- Google Calendar link and `.ics` export
- App-only event and member management, without spreadsheet sync
- Persistent storage with Neon Postgres on Vercel

## Environment Variables

Set these variables on Vercel or in the distribution `.env` file. `DATABASE_URL` is preferred. `POSTGRES_URL` also works.

Use a new database for this app. Do not reuse the existing `GENS_RSVP` database connection string.

```env
DATABASE_URL="postgres://user:password@host/gens_schedule_distribution?sslmode=require"
ORGANIZATION_NAME="GENS"
ORGANIZATION_CODE="GENS"
ADMIN_PASSCODE="change-this-passcode"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-this-password"
ADMIN_NAME="Admin"
```

The app creates its tables automatically on first access. `ORGANIZATION_NAME`, `ORGANIZATION_CODE`, and `ADMIN_PASSCODE` create the first organization. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the first admin member is also created automatically.

Login stays lightweight: users enter an organization code and select their member name. Admin-only operations require the organization's admin passcode.

## Permissions

- Admin: create, edit, and delete events; add and delete members; back up and restore organization data; suspend or delete the organization
- Member: view events and answer RSVP

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
