# Taskora

Taskora is a full-stack team task manager where users can create projects, manage members, assign tasks, and track progress with project-level Admin and Member access.

## Features

- Signup and login with JWT authentication
- Password hashing with bcrypt
- Hosted Supabase database
- Project creation with creator assigned as Admin
- Project member management by Admin users
- Task creation, assignment, status tracking, and deletion
- Member access limited to assigned tasks
- Dashboard summary for task totals, status, overdue work, and workload per user

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express |
| Database | Supabase Postgres |
| Auth | JWT, bcryptjs |
| Deployment Target | Railway |

## Supabase Setup

1. Create a Supabase project.
2. Open **SQL Editor** in Supabase.
3. Run the SQL from `supabase-schema.sql`.
4. Copy the project URL and anon key from **Project Settings > API**.

The backend seeds demo data automatically when the `users` table is empty.

## Environment Variables

Use these variables locally and on Railway:

```env
JWT_SECRET_KEY=your_strong_jwt_secret
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_NAME=Taskora
VITE_APP_ENV=production
```

`JWT_SECRET` is also supported, but `JWT_SECRET_KEY` is recommended for this deployment.

## Data Model

- `users`: account profile and hashed password
- `projects`: project details and creator reference
- `project_members`: project membership with Admin or Member role
- `tasks`: task details, assignee, creator, due date, status, and priority

Task enums:

- Status: `TODO`, `IN_PROGRESS`, `DONE`
- Priority: `LOW`, `MEDIUM`, `HIGH`

## Local Setup

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

## Demo Account

After the first successful database connection, the app seeds demo accounts.

```text
Email: aryan@taskora.app
Password: Password@123
```

## API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/projects` | List current user's projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Project detail and members |
| POST | `/api/projects/:id/members` | Add member, Admin only |
| DELETE | `/api/projects/:id/members/:uid` | Remove member, Admin only |
| GET | `/api/tasks?project_id=:id` | List tasks by project |
| GET | `/api/tasks/my` | Current user's assigned tasks |
| POST | `/api/tasks` | Create task, Admin only |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task, Admin only |
| GET | `/api/dashboard` | Dashboard summary |
| GET | `/api/health` | Deployment health check |

## Railway Deployment

1. Push the project to GitHub.
2. Create a Railway project from the GitHub repository.
3. Add the environment variables listed above to the Railway service.
4. Redeploy the service.
5. Check `/api/health`.

Expected health flags:

```json
{
  "hasJwtSecret": true,
  "hasSupabaseConfig": true
}
```
