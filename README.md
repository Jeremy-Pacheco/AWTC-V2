<div align="center">

<img src="frontend/public/awtc-logo.png" alt="A Will To Change logo" width="96" />

# A Will To Change — V2

**A volunteer management platform: projects, enrollments, reviews, real-time chat and an admin dashboard.**

[![Live demo](https://img.shields.io/badge/live%20demo-awtc.jeremypacheco.es-12a36f?style=for-the-badge)](https://awtc.jeremypacheco.es)
[![API docs](https://img.shields.io/badge/API%20docs-Swagger-0b7a52?style=for-the-badge)](https://awtc-api.jeremypacheco.es/api-docs)

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Sequelize-4479a1?logo=mysql&logoColor=white)

</div>

---

## About this fork

This repository is **V2** of [**Jeremy-Pacheco/AWTC**](https://github.com/Jeremy-Pacheco/AWTC), the original project. V2 starts from the same code and takes it further:

- **Public demo** that anyone can try without signing up, with one-click accounts for every role.
- **Security hardening** after a full audit: authorization on every endpoint, server-side validation, CSRF protection, security headers, rate limiting and rotating refresh tokens.
- **New design**: the *Esmeralda* palette, the Geist font, a softer dark mode and an animated theme switch.
- **Tests and CI**: frontend and backend unit tests, plus integration tests on a real MySQL database, run by GitHub Actions on every pull request.
- **Free cloud deployment** with Vercel, Render, Aiven and Cloudinary, instead of a single self-managed server.

The original repository keeps the first version of the project as it was built.

---

## Live demo

> **[awtc.jeremypacheco.es](https://awtc.jeremypacheco.es)**

Open **Log in** and choose **one of the three demo accounts**. No password is needed:

| Role | What you can try |
| --- | --- |
| **Volunteer** | Browse projects, sign up for them, leave reviews, chat with coordinators, edit your profile |
| **Coordinator** | Create and edit your projects, accept or reject volunteers, moderate reviews |
| **Admin** | Manage users, roles, categories and every project, and see the dashboard statistics |

| Link | |
| --- | --- |
| Web app | [awtc.jeremypacheco.es](https://awtc.jeremypacheco.es) |
| REST API (example) | [awtc-api.jeremypacheco.es/api/projects](https://awtc-api.jeremypacheco.es/api/projects) |
| API documentation | [awtc-api.jeremypacheco.es/api-docs](https://awtc-api.jeremypacheco.es/api-docs) |
| Admin dashboard (EJS) | [awtc-api.jeremypacheco.es](https://awtc-api.jeremypacheco.es), then *"Enter as demo admin"* |

**Good to know**

- All data is **fake** and is **reset every night at 03:00 UTC**, so feel free to break things.
- Some actions are blocked in the demo so it stays usable for everyone: deleting the demo accounts, changing their roles, and uploading images larger than 1 MB.
- The backend runs on Render's free plan and goes to sleep when idle. **The first request may take up to a minute**; after that it runs at normal speed.

---

## Features

- **Accounts and roles**: sign up and log in, edit your profile and picture, with three roles (volunteer, coordinator, admin).
- **Projects**: create, edit and delete projects, with categories, dates, location and images. Coordinators manage only their own projects.
- **Enrollments**: volunteers sign up for projects, and coordinators accept, reject or complete them, or ban a user from a project.
- **Reviews**: ratings with images, updated live with Socket.IO.
- **Real-time chat** between users, with unread counters.
- **Push notifications** through a Service Worker and Web Push.
- **Dashboards**: a React dashboard for every role, and an EJS admin panel with D3 charts.
- **Three languages**: English, Spanish and French (i18next).
- **Light and dark themes** with an animated switch.
- **API documentation** with Swagger/OpenAPI at `/api-docs`.

### Security

- Passwords hashed with **bcrypt**, or handled by **OpenLDAP** (`AUTH_PROVIDER=local|ldap`).
- **Access tokens** valid for 15 minutes, plus an `httpOnly` **refresh token** that changes on every use.
- Role-based access control and ownership checks on every write endpoint.
- **Zod** validates every request body and `:id` parameter on the server.
- **Helmet** sets the security headers, including a CSP with a nonce.
- **CSRF** protection, the session ID changes on login, and sessions are stored in the database.
- **Rate limiting** on authentication endpoints, and CORS configured through environment variables.

---

## Security audit: what we found and fixed

Before publishing the demo, the whole project, frontend and backend, went through a **full security and code audit**. The original version worked well as an academic project, but it was **not safe to put online**: several flaws let someone take over an admin account, or read and change data without logging in.

All the findings below are **fixed in V2**. Each fix was made in its own pull request and is covered by tests where possible.

| Severity | What we found | How V2 fixes it |
| --- | --- | --- |
| Critical | The **JWT signing secret** had a default value written in the code, so anyone could create a valid admin token. | Secrets come only from environment variables. The server refuses to start if one is missing or is one of the values that leaked. |
| Critical | **Debug endpoints** that anyone could call returned whole database tables, including users, private messages and contacts. | Removed. |
| Critical | The **real-time chat** trusted the user ID sent by the browser, so anyone could impersonate an admin and read their messages. | The socket identifies the user from their verified token. |
| Critical | **Editing and deleting projects** required no login at all. | Authentication, role checks and project ownership on every write endpoint. |
| Critical | **Stored XSS** in the admin panel, which could be triggered from the public contact form. | Output escaping, plus a strict Content Security Policy with nonces. |
| Critical | **Unrestricted file uploads**: HTML or SVG files were served from the app's own domain and could steal sessions. | Only images are accepted, checked by type and size, and stored on Cloudinary. |
| Critical | **Secrets committed to git**: `.env` files and the production database credentials. | Removed from the repository, git-ignored, replaced by `.env.example`, and documented in a [rotation guide](docs/credential-rotation.md). |
| High | Any logged-in user, even a volunteer, could open the **admin dashboard**. | Admin-only access to the dashboard. |
| High | **No protection against brute force** on login. | Rate limiting on login, sign-up, token refresh and the contact form. |
| High | **62 known vulnerabilities in dependencies** (4 critical): 27 in the backend and 35 in the frontend. | Dependencies updated and vulnerable sub-dependencies patched. `pnpm audit` now reports none. |
| High | **Session cookies without CSRF protection**, and sessions that were not regenerated on login. | CSRF tokens, a new session ID on login, and sessions stored in the database. |
| Medium | Tokens valid for 24 hours that **logging out did not revoke**. | 15-minute access tokens and refresh tokens that change on every use and are revoked on logout. |
| Medium | **No validation on the server**, mass assignment, LDAP injection and TLS certificates not verified. | Zod schemas, field allowlists, escaped LDAP DNs, and verified TLS for the database and external APIs. |

On the code side, the audit also took **TypeScript from 24 errors and ESLint from 57 problems to zero**. It split the 1,000-line files into modules and added **integration tests on a real MySQL database** that check every role's permissions.

---

## Infrastructure changes

### Database: DigitalOcean to Aiven

The original app ran on a **self-managed DigitalOcean server** with a managed MySQL database. V2 moved to a **new MySQL database on Aiven's free plan** for three reasons:

- **Security:** the old database credentials had been committed to the repository. Starting fresh with new credentials, which never touched git, was safer than reusing it.
- **Cost:** the public demo had to run for free. Aiven gives a free MySQL database with TLS, Render runs the API, Vercel serves the frontend and Cloudinary stores the images.
- **Performance:** the database and the backend run in the same region (Frankfurt). Placing them together cut API response times from about 0.7–1 s to about 0.2 s.

The old server has since been retired.

### Package manager: npm to pnpm

Both the frontend and the backend moved from **npm to pnpm** because:

- **Patching vulnerable sub-dependencies:** pnpm `overrides` let us force safe versions of indirect packages (such as `uuid`, `glob` and `minimatch`) without waiting for the libraries that use them to update.
- **Supply-chain protection:** pnpm does not run dependencies' install scripts unless they are explicitly allowed, so a compromised package cannot run code just by being installed.
- **Strict dependencies:** the code can only import packages that are declared in `package.json`. This avoids "phantom dependencies" that work locally and break later.
- **Speed and disk space:** a shared store and hard links make installs, CI runs and deployments faster.

---

## Tech stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7, i18next, Framer Motion, GSAP, Axios, Socket.IO client |
| **Backend** | Node.js, Express 5, Sequelize + MySQL, JWT, bcrypt, ldapjs, Socket.IO, Web Push, Multer, Zod, Helmet, Winston, Swagger, EJS + D3 |
| **Storage** | Local disk or **Cloudinary** (`STORAGE_PROVIDER=local\|cloudinary`) |
| **Testing** | Vitest + Testing Library (frontend), Jest + Supertest (backend unit and MySQL integration tests) |
| **Infra** | Vercel (frontend), Render (backend), Aiven (MySQL), Cloudinary (images), GitHub Actions (CI and the nightly demo reset) |

---

## Running it locally

### Prerequisites

- **Node.js** 22 (the version CI uses)
- **pnpm** (this project uses pnpm, not npm)
- **MySQL** 8
- *(Optional)* **Docker**, only if you want to use OpenLDAP instead of local authentication

### 1. Backend

```bash
cd backend
pnpm install
cp .env.example .env.development.local   # fill in your values (this file is git-ignored)
pnpm migrate
pnpm seed
pnpm dev                                 # http://localhost:8080
```

- Generate `JWT_SECRET` and `SESSION_SECRET` with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- Generate VAPID keys with: `npx --yes web-push generate-vapid-keys`
- To use LDAP instead: run `docker compose up -d`, set `AUTH_PROVIDER=ldap`, and follow [docs/ldap-local-setup.md](docs/ldap-local-setup.md).

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm dev                                 # http://localhost:5173
```

The frontend expects the backend on port `8080`.

### Useful scripts

| Where | Command | What it does |
| --- | --- | --- |
| backend | `pnpm dev` / `pnpm start` | Start the server in development / production mode |
| backend | `pnpm migrate` / `pnpm seed` | Run the migrations / seed the initial data |
| backend | `pnpm test` | Unit tests |
| backend | `pnpm test:integration` | Integration tests (needs MySQL) |
| frontend | `pnpm dev` / `pnpm build` | Development server / production build |
| frontend | `pnpm test` / `pnpm lint` / `pnpm typecheck` | Tests / ESLint / TypeScript |

---

## Deploy your own demo

Everything runs on free plans: **Vercel**, **Render**, **Aiven MySQL**, **Cloudinary** and **GitHub Actions**. Setting `DEMO_MODE=true` enables the one-click accounts and the safety limits.

- [docs/deploy-demo.md](docs/deploy-demo.md): step-by-step deployment guide
- [docs/demo-runbook.md](docs/demo-runbook.md): how the live demo is configured
- [docs/credential-rotation.md](docs/credential-rotation.md): how to rotate the secrets

---

## Project structure

```
AWTC-V2/
├── backend/            Express API + EJS admin dashboard
│   ├── config/         CORS, security headers, secrets, Sequelize
│   ├── controllers/    Request handlers
│   ├── middlewares/    Authentication, roles, CSRF, validation
│   ├── models/         Sequelize models
│   ├── migrations/     Database schema
│   ├── seeders/        Initial data
│   ├── routes/         API and dashboard routes
│   ├── services/       Authentication, storage, demo mode, push notifications
│   ├── validation/     Zod schemas
│   ├── views/          EJS templates
│   └── tests/          Unit and integration tests
├── frontend/           React + TypeScript single-page app
│   └── src/
│       ├── components/ Shared UI (NavBar, Chat, modals, theme toggle…)
│       ├── pages/      Pages, including dashboard/ (one tab per feature)
│       ├── context/    Authentication state (AuthProvider)
│       ├── i18n/       en / es / fr translations
│       └── tests/      Vitest tests
├── docs/               Guides and diagrams
└── render.yaml         Render Blueprint for the backend
```

---

## API overview

The full, interactive reference is in **[Swagger](https://awtc-api.jeremypacheco.es/api-docs)**. The main groups of endpoints are:

| Area | Base path |
| --- | --- |
| Authentication | `/api/users/signup`, `/api/users/login`, `/api/auth/refresh`, `/api/auth/logout` |
| Projects and volunteers | `/api/projects`, `/api/projects/:id/volunteers` |
| Categories | `/api/categories` |
| Reviews | `/api/reviews` |
| Users | `/api/users` |
| Messages | `/api/messages` |
| Contacts | `/api/contacts` |
| Push notifications | `/api/subscriptions` |
| Demo | `/api/demo` |

---

## Documentation and design

- [System diagrams](docs/diagrams.md): entity–relationship, class and use-case diagrams
- [Tests overview](docs/tests-overview.md)
- [Swagger notes](docs/swagger.md) · [Logs](docs/logs-documentation.md) · [Admin dashboard](docs/backend-dashboard.md)
- [Figma mockups](https://www.figma.com/design/vjAlUkbNwIuZIhn4Y4IYlx/AWillToChange?node-id=3-195&t=TTOPEcQyHpJGTaGN-1)
- [Postman collection](https://documenter.getpostman.com/view/49651382/2sB3WpQ1PH)
- [Project board](https://github.com/users/Jeremy-Pacheco/projects/2)

---

<div align="center">

Made by **[Jeremy Pacheco](https://github.com/Jeremy-Pacheco)** · Fork of [AWTC](https://github.com/Jeremy-Pacheco/AWTC)

</div>
