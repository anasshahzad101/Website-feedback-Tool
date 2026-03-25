# SpeedX Marketing — Feedback Tool

A production-ready internal web application for visual review and feedback management, built for SpeedX Marketing agency.

## Features

### Core Functionality
- **Multi-content Review**: Review websites, images, PDFs, and videos
- **Visual Annotation**: Pin, rectangle, arrow, freehand, and text annotations
- **Threaded Comments**: Organized discussion threads with status tracking
- **Guest Access**: Share links with controlled guest commenting
- **Revision Management**: Track changes with dated revision history
- **Activity Logging**: Complete audit trail of all actions
- **Email Notifications**: Automated email alerts for comments and status changes

### User Roles & Permissions
- **Owner**: Full system access
- **Admin**: User management and system settings
- **Project Manager**: Create projects, manage members, full review access
- **Reviewer**: Comment, annotate on assigned projects
- **Client**: Limited access to assigned review items
- **Guest**: Access via share links with permission controls

### Content Review Modes
- **Website Review**: 
  - Screenshot capture mode (recommended, reliable)
  - Live iframe preview (when allowed by target site)
- **Image Review**: Inline image viewer with annotation overlay
- **PDF Review**: Inline PDF viewer with per-page annotations
- **Video Review**: Inline video player with timestamp-based annotations

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: MySQL (production) — optional SQLite for local dev without MySQL (`USE_SQLITE=true`)
- **ORM**: Prisma
- **Authentication**: Auth.js (NextAuth v5) with credentials provider
- **State Management**: React Query + Zustand (annotation state)
- **Validation**: Zod
- **Email**: Nodemailer
- **File Storage**: Local filesystem (S3-compatible ready)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (login)
│   ├── (dashboard)/       # Dashboard routes
│   ├── api/               # API routes
│   └── review/[token]/    # Guest review pages
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components
│   ├── viewers/           # Content viewers
│   ├── annotations/       # Annotation system
│   ├── comments/          # Comment system
│   ├── forms/             # Form components
│   ├── dashboard/         # Dashboard widgets
│   ├── clients/           # Client components
│   ├── projects/          # Project components
│   ├── review-items/      # Review item components
│   ├── activity/          # Activity log components
│   └── guest/             # Guest access components
├── lib/
│   ├── auth/              # Auth configuration & permissions
│   ├── db/                # Database client
│   ├── email/             # Email service
│   ├── storage/           # File storage service
│   └── validations/       # Zod schemas
├── modules/               # Business logic modules
└── types/                 # TypeScript types
```

## Setup Instructions

### Prerequisites
- **Node.js 20+** (see [`.nvmrc`](.nvmrc); `nvm use` if you use nvm)
- **MySQL** for production-like setup, **or** enable **SQLite** for quick local dev (see below)
- SMTP provider if you want outbound email (optional for local try-out)

### Environment variables

1. Copy the example file (this file is safe to commit; **never commit `.env`**):

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`. For **local dev without MySQL**, keep `USE_SQLITE=true` in `.env` and use the SQLite scripts. For **MySQL**, set `USE_SQLITE=false` (or remove it) and set `DATABASE_URL` to your MySQL connection string.

3. **Production / hosted**: set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your public HTTPS origin (no trailing slash), and a strong `AUTH_SECRET` (32+ characters).

All variables are documented in [`.env.example`](.env.example).

### Installation

```bash
npm install

# Prisma client (respects USE_SQLITE in .env via postinstall script)
# SQLite-only local setup:
npm run db:local:setup

# OR with MySQL: create DB, then:
# npm run db:generate && npm run db:migrate && npm run db:seed

npm run dev
```

Use **`npm run db:local:*`** when `USE_SQLITE=true`; use **`npm run db:migrate`** / **`npm run db:deploy`** with MySQL.

### First deploy (no users yet)

If the database has **no users** (typical on a fresh production MySQL after migrations), visiting `/` sends you to **`/setup`** to create the **owner** account and optional branding. After that, use **Settings → White-label branding** (Owner/Admin) to change **name, tagline, and logo**. Env vars `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_APP_NAME` still apply as fallbacks when the DB row is empty.

**MySQL:** apply the `app_settings` table (included in Prisma migrations under `prisma/migrations/`) with `npx prisma migrate deploy` after deploy.

### Hostinger: all variables in one place

Fill in **[`hostinger.env.template`](hostinger.env.template)** (commented) or **[`hostinger.import.env`](hostinger.import.env)** (one variable per line, easy for Hostinger “import .env”) with your MySQL URL, domain, and a generated `AUTH_SECRET`, then import or paste into **hPanel → Node.js → Environment variables**. **Do not commit** a filled file to git.

### Demo credentials (local seed only)

After **`npm run db:local:seed`** or **`npm run db:seed`**, users are defined in [prisma/seed.ts](prisma/seed.ts) (e.g. owner `owner@speedxmarketing.com` / `admin123`). **Change passwords** before any production deploy; do not use demo logins on a public server.

## Database Schema

Key entities:
- **User**: Internal team members
- **Client**: External clients
- **Project**: Client projects
- **ProjectMember**: Project assignments with roles
- **ReviewItem**: Items to review (websites, images, PDFs, videos)
- **ReviewRevision**: Version history
- **Annotation**: Visual markers on review items
- **CommentThread**: Discussion threads
- **CommentMessage**: Individual comments/replies
- **GuestIdentity**: Guest commenter identities
- **ShareLink**: Public/guest access links
- **ActivityLog**: Audit trail
- **EmailNotification**: Notification queue

## API Routes

### Auth
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Clients
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `GET /api/clients/[id]` - Get client details
- `PATCH /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Delete client

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project

### Review Items
- `GET /api/review-items` - List review items
- `POST /api/review-items` - Create review item
- `GET /api/review-items/[id]` - Get review item details
- `PATCH /api/review-items/[id]` - Update review item
- `DELETE /api/review-items/[id]` - Delete review item

### Annotations
- `GET /api/annotations` - List annotations
- `POST /api/annotations` - Create annotation

### Comments
- `GET /api/comments` - List comment threads
- `POST /api/comments` - Create comment thread
- `PATCH /api/comments` - Add reply

### Sharing
- `GET /api/shares` - List share links
- `POST /api/shares` - Create share link
- `DELETE /api/shares/[id]` - Revoke share link

### Guest
- `POST /api/guest/identity` - Create guest identity
- `POST /api/guest/comment` - Submit guest comment

### Activity
- `GET /api/activity` - Get activity log

## GitHub & hosting (e.g. Hostinger)

This repo is set up so you can push to GitHub and import the project from there in **Hostinger hPanel** (Node.js → **Import from GitHub**).

**Do not commit:**

- `.env` or any file containing real secrets (see [.gitignore](.gitignore); [`.env.example`](.env.example) is the template only)

**Do commit:**

- `package.json` / `package-lock.json`, Prisma schema, application source, and `.env.example`

**On the server (after import):**

- Set environment variables in the panel (MySQL `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, etc. — mirror `.env.example`).
- Production: **omit** `USE_SQLITE` or set `USE_SQLITE=false`; use MySQL.
- Run **`npx prisma migrate deploy`** when you use Prisma migrations against MySQL (or follow your team’s DB workflow).
- **`npm run build`** then **`npm start`** (see [`package.json`](package.json) `start` script; Hostinger may set `PORT`).
- Ensure **`public/uploads`** (or your `UPLOAD_DIR`) persists across deploys if you use local file storage.

## Deployment

### Docker (optional)

You can containerize with Node 20+; ensure `DATABASE_URL`, auth env, and upload volume are configured at runtime. A `Dockerfile` is not included in this repo by default.

## Development Phases

### Phase 1 (Current): Core Foundation
- [x] Project scaffolding
- [x] Authentication system
- [x] Database schema
- [x] Role-based permissions
- [x] CRUD for clients, projects, review items

### Phase 2: File Handling & Viewers
- [x] File upload infrastructure
- [x] Image viewer
- [x] PDF viewer
- [x] Video viewer
- [x] Website review (screenshot + iframe)

### Phase 3: Annotation & Comments
- [x] Annotation engine
- [x] Comment threads
- [x] Status management
- [x] Sidebar sync

### Phase 4: Guest Features
- [x] Share links
- [x] Guest identity
- [x] Guest commenting
- [x] Email notifications
- [x] Activity logs

### Phase 5: Refinements
- [ ] Revisions by date
- [ ] Screenshot context
- [ ] Responsive polish
- [ ] Permissions hardening
- [ ] Performance optimization

## Security Considerations

- Password hashing with bcrypt
- CSRF protection via SameSite cookies
- Input validation with Zod
- Server-side authorization checks
- Rate limiting on auth endpoints
- File upload type and size validation
- Secure guest share tokens
- SQL injection protection via Prisma ORM

## Browser Extension (Future)

The architecture supports future browser extension integration:
- API endpoints for external capture
- Screenshot context storage
- Cross-origin annotation submission
- OAuth-like token authentication

## Source

- Made with [Cursor](https://cursor.com)

Prisma includes Linux engine targets (e.g. `rhel-openssl-3.0.x` in [prisma/schema.prisma](prisma/schema.prisma)) for hosting on common Linux runtimes.

## License

Private - SpeedX Marketing Internal Use Only
