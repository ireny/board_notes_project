# Board Notes Project Documentation

## 1) Project Description
Board Notes is a Trello-style project and task management web app.

### What the app does
- User registration and login with Supabase Auth
- Project creation and management
- Kanban task board per project with drag-and-drop between stages
- Task CRUD (create, edit, delete)
- Task attachments (files and images)
- Project user/member management

### Who can do what
- **Project owner** can:
  - Create/edit/delete projects and stages
  - Create/edit/delete tasks
  - Manage project members
  - Upload/delete task attachments
- **Project member** can:
  - View projects/tasks they are assigned to (via access policies)
  - View attachments in accessible projects

> Note: Current Row Level Security (RLS) policies are owner-first for write operations, and owner/member for read access in most project resources.

---

## 2) Architecture

### Front-end
- Vanilla JavaScript (ES Modules)
- HTML + CSS + Bootstrap 5
- Vite for development/build
- Custom client-side router (`src/router/routes.js`)

### Back-end
- Supabase
  - PostgreSQL database
  - Supabase Auth
  - Supabase Storage (`task-attachments` bucket)
  - RLS for authorization

### Core technologies
- `@supabase/supabase-js`
- `bootstrap`
- `vite`

### Runtime model
- Single-page application (SPA)
- Browser client talks directly to Supabase using publishable/anon key and authenticated session token

---

## 3) Database Schema Design
Main entities and relationships:

```mermaid
erDiagram
  projects ||--o{ project_stages : has
  projects ||--o{ tasks : has
  projects ||--o{ project_members : has
  tasks ||--o{ task_attachments : has
  projects ||--o{ task_attachments : has

  projects {
    uuid id PK
    text title
    text description
    uuid owner_id FK
    timestamptz created_at
    timestamptz updated_at
  }

  project_members {
    uuid project_id PK, FK
    uuid user_id PK, FK
    text role
    timestamptz created_at
  }

  project_stages {
    uuid id PK
    uuid project_id FK
    text title
    int position
    timestamptz created_at
  }

  tasks {
    uuid id PK
    uuid project_id FK
    uuid stage_id FK
    text title
    text description_html
    int order_position
    boolean done
    timestamptz created_at
    timestamptz updated_at
  }

  task_attachments {
    uuid id PK
    uuid project_id FK
    uuid task_id FK
    uuid uploaded_by FK
    text file_name
    text mime_type
    bigint file_size
    text bucket_path UNIQUE
    timestamptz created_at
  }
```

### Migration files (Supabase)
Located in `supabase/migrations/`:
- `202603030001_taskboard_core_schema.sql`
- `202603030002_fix_rls_policy_recursion.sql`
- `202603030003_projects_owner_default_auth_uid.sql`
- `202603030004_projects_insert_owner_trigger_policy.sql`
- `202603030005_add_create_project_rpc.sql`
- `202603030006_project_members_roles_and_management.sql`
- `202603030007_fix_project_members_rpc_return_types.sql`
- `202603040001_task_attachments.sql`
- `202603040002_harden_storage_project_id_from_path.sql`

---

## 4) Local Development Setup Guide

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase project (URL + publishable/anon key)

### Environment variables
Create `.env.local` in the project root:

```dotenv
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

(`VITE_SUPABASE_PUBLISHABLE_KEY` is also supported by the client helper.)

### Install dependencies
```bash
npm install
```

### Run development server
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

### Preview build
```bash
npm run preview
```

### Seed sample data (optional)
```bash
npm run seed:sample
```

### Apply database migrations
Run SQL migrations from `supabase/migrations/` in your Supabase project (SQL Editor or migration pipeline), in chronological order.

---

## 5) Key Folders and Files

### Root
- `index.html` – app HTML shell
- `package.json` – scripts and dependencies
- `vite.config.js` – Vite configuration
- `readmy.md` – this documentation

### Source (`src/`)
- `main.js` – app bootstrap entry
- `app.js` – app composition and navigation wiring
- `router/routes.js` – route definitions and dynamic route resolution
- `lib/supabase-client.js` – Supabase client initialization and auth-aware helper

### Components (`src/components/`)
- `headre/` – top navigation/header component
- `footer/` – footer component
- `task-editor/` – reusable task create/edit modal component with attachments

### Pages (`src/pages/`)
- `index/` – landing page
- `login/`, `register/` – authentication pages
- `dashboard/` – user dashboard
- `projects/` – projects listing
- `project-form/` – create/edit project page
- `project-detail/` – single project details
- `project-tasks/` – Kanban board page
- `project-users/` – project member management page

### Styling
- `src/styles/global.css` – global styles/tokens

### Supabase
- `supabase/migrations/` – database schema and policy migrations
- `supabase/scripts/seed-sample-data.mjs` – sample data seed script

---

## 6) Notes
- Routing currently includes both `/projects/{id}`-style and `/project/{id}/tasks`-style paths.
- Attachments are stored in the `task-attachments` private storage bucket and accessed via signed URLs.
- Authorization is enforced primarily through PostgreSQL RLS policies.
