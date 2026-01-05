# DOK1 Grading App

## Overview

A reusable grading tool for educational "brainlifts" - structured analyses of educational content. Each brainlift gets its own URL and displays facts, contradiction clusters, and reading lists. The app allows users to upload documents (PDF, Word) or paste text to generate new brainlift analyses using AI.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom color system using CSS variables
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: REST endpoints defined in `server/routes.ts`
- **File Uploads**: Multer for handling document uploads (PDF, DOCX)
- **Document Processing**: Mammoth for Word document text extraction

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: brainlifts, facts, contradiction_clusters, reading_list_items

### AI Integration
- **Provider**: OpenRouter API (configured for Claude Sonnet 4)
- **Purpose**: Extracts structured brainlift data from uploaded documents
- **Location**: `server/ai/brainliftExtractor.ts`

### Key Design Decisions

1. **Monorepo Structure**: Client code in `client/`, server in `server/`, shared types in `shared/`
2. **Type Safety**: Shared Zod schemas ensure consistent validation between frontend and backend
3. **Database Seeding**: Initial brainlifts seeded from JSON files in `attached_assets/`
4. **Build Process**: Custom build script bundles server dependencies to reduce cold start times

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Connection pooling with `pg` package
- Session storage with `connect-pg-simple`

### AI Services
- OpenRouter API via `OPENROUTER_API_KEY` environment variable
- Used for document analysis and brainlift generation

### Document Processing
- Mammoth: Converts Word documents (.docx) to text for AI processing

### UI Libraries
- Full shadcn/ui component set (Radix UI primitives)
- Lucide React for icons
- Embla Carousel, React Day Picker, Recharts for specialized components