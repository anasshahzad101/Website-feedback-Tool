# Setup Guide - SpeedX Marketing Feedback Tool

## Quick Start

### 1. Install Dependencies

```bash
cd "/Users/anasshahzad/Desktop/Cursor/Markup Io"
npm install
```

### 2. Database Setup

Make sure PostgreSQL is running, then:

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL="postgresql://user:password@localhost:5432/speedx_feedback?schema=public"

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with demo data
npm run db:seed
```

### 3. Email Configuration (Optional for local dev)

Edit `.env` with your SMTP settings:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="SpeedX Marketing <noreply@speedxmarketing.com>"
```

For Gmail, use an App Password from your Google Account settings.

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Demo Credentials

After seeding the database, use these credentials to log in:

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@speedxmarketing.com | admin123 |
| Admin | admin@speedxmarketing.com | admin123 |
| Project Manager | pm@speedxmarketing.com | pm123 |
| Reviewer | reviewer@speedxmarketing.com | reviewer123 |

## Features Overview

### Core Workflow

1. **Create a Client**: Go to `/clients` → Add Client
2. **Create a Project**: Go to `/projects` → New Project (select client)
3. **Add Review Items**: 
   - Website: Enter URL, choose review mode (screenshot recommended)
   - Image/PDF/Video: Upload file
4. **Review & Comment**: 
   - Open review item
   - Select annotation tool (pin, rectangle, arrow, freehand, text)
   - Click on content to place annotation
   - Add comment in sidebar
5. **Share with Guests**: Generate share link, send to clients
6. **Track Activity**: View activity log for all changes

### User Roles

- **Owner**: Full system access
- **Admin**: User management, system settings
- **Project Manager**: Create projects, manage members, all reviews
- **Reviewer**: Comment and annotate on assigned projects
- **Client**: Limited access to assigned items
- **Guest**: Access via share links only

### Annotation Tools

1. **Pin**: Drop a marker with comment
2. **Rectangle**: Highlight an area
3. **Arrow**: Point to specific elements
4. **Freehand**: Draw custom shapes
5. **Text**: Add text labels

### Comment Statuses

- **Open**: New comment, needs attention
- **In Progress**: Being worked on
- **Resolved**: Issue fixed/addressed
- **Closed**: No action needed
- **Ignored**: Decision made to not address

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

### Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── (auth)/       # Authentication routes
│   ├── (dashboard)/  # Dashboard routes
│   ├── api/          # API routes
│   └── review/       # Guest review pages
├── components/       # React components
├── lib/             # Utilities and services
└── modules/         # Business logic
```

## Production Deployment

### Hostinger Cloud Server

1. **Upload files**:
   ```bash
   npm run build
   rsync -avz --exclude='node_modules' --exclude='.next' . user@server:/path/to/app
   ```

2. **Install dependencies on server**:
   ```bash
   cd /path/to/app
   npm ci --production
   ```

3. **Environment variables**:
   Set up production `.env` with:
   - Production database URL
   - Production SMTP settings
   - `NODE_ENV=production`

4. **Database**:
   ```bash
   npm run db:deploy
   ```

5. **Start application**:
   ```bash
   npm start
   ```

### PM2 Configuration (Recommended)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'speedx-feedback',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }],
};
```

Start with: `pm2 start ecosystem.config.js`

## Troubleshooting

### Database connection issues
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists

### Email not sending
- Check SMTP credentials
- For Gmail, ensure App Password is used
- Check spam folders

### File uploads not working
- Ensure `public/uploads` directory exists and is writable
- Check file size limits in next.config.js

### Build errors
- Run `npm run typecheck` to check TypeScript
- Clear `.next` folder and rebuild

## Support

For technical support or feature requests, contact the development team.
