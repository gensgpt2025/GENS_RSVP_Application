# GENS Schedule

Private schedule and RSVP management app for pre-registered members.

## Features

- Organization-code login with member selection
- Member registration from inside each organization
- Event creation, editing, and deletion from inside each organization
- RSVP responses: attending, declined, maybe
- Google Calendar link and `.ics` export
- App-only event and member management, without spreadsheet sync
- Site-admin-only organization management, backup, restore, and organization passcode changes
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
```

The app creates its tables automatically on first access. `ORGANIZATION_NAME` and `ORGANIZATION_CODE` create the first organization and an initial selectable member.

Login stays lightweight: users enter an organization code and select their member name. Organization management, backup, restore, and organization passcode changes require the site admin credentials. The default site admin username is `sugaya`; set `SITE_ADMIN_PASSWORD` on Vercel.

## Permissions

- Site admin: create, suspend, and delete organizations; change organization passcodes; back up and restore organization data
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
