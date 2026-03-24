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
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js with credentials provider
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
- Node.js 18+ 
- PostgreSQL 14+
- SMTP email provider (Gmail, SendGrid, etc.)

### Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/speedx_feedback?schema=public"

# NextAuth
AUTH_SECRET="your-auth-secret-here-min-32-chars-long"
AUTH_TRUST_HOST="true"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="SpeedX Marketing — Feedback Tool"
NEXT_PUBLIC_BRAND_NAME="SpeedX Marketing"

# Storage
STORAGE_TYPE="local"
UPLOAD_DIR="./public/uploads"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="SpeedX Marketing <noreply@speedxmarketing.com>"
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database with demo data
npm run db:seed

# Start development server
npm run dev
```

### Demo Credentials

After seeding, you can log in with:

- **Owner**: `owner@speedxmarketing.com` / `admin123`
- **Admin**: `admin@speedxmarketing.com` / `admin123`
- **Project Manager**: `pm@speedxmarketing.com` / `pm123`
- **Reviewer**: `reviewer@speedxmarketing.com` / `reviewer123`

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

## Deployment

### Hostinger Cloud Server Deployment

1. **Build the application**:
```bash
npm run build
```

2. **Environment setup on server**:
- Set up PostgreSQL database
- Configure environment variables
- Set `NODE_ENV=production`
- Configure SMTP settings

3. **File storage**:
- Ensure upload directory is writable
- Configure S3-compatible storage for production if needed

4. **Database**:
```bash
npm run db:deploy
```

5. **Start application**:
```bash
npm start
```

### Docker (Optional)

A Dockerfile can be added for containerized deployment:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

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

## License

Private - SpeedX Marketing Internal Use Only
