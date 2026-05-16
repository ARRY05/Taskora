# Taskora

Taskora is a full-stack team task manager where users can create projects, manage team members, assign tasks, and track progress with project-level Admin and Member access.

## Features

- Signup and login with JWT authentication
- Password hashing with bcrypt
- Project creation with creator assigned as Admin
- Project member management by Admin users
- Task creation, assignment, status tracking, and deletion
- Member access limited to assigned tasks
- Dashboard summary for task counts, status, overdue work, and workload per user
- REST APIs backed by a SQL database

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express |
| Database | SQLite through `sql.js` |
| Auth | JWT, bcryptjs |
| Deployment Target | Railway |

## Data Model

- `users`: account profile and hashed password
- `projects`: project details and creator reference
- `project_members`: project membership with Admin or Member role
- `tasks`: task details, assignee, creator, due date, status, and priority

Task enums are stored as strict backend values:

- Status: `TODO`, `IN_PROGRESS`, `DONE`
- Priority: `LOW`, `MEDIUM`, `HIGH`

## API Overview

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login and receive JWT |

### Projects

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/projects` | Project members |
| POST | `/api/projects` | Authenticated users |
| GET | `/api/projects/:id` | Project members |
| POST | `/api/projects/:id/members` | Project Admin |
| DELETE | `/api/projects/:id/members/:uid` | Project Admin |
| DELETE | `/api/projects/:id` | Project Admin |

### Tasks

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/tasks?project_id=:id` | Admin sees project tasks; Member sees assigned tasks |
| GET | `/api/tasks/my` | Current user's assigned tasks |
| POST | `/api/tasks` | Project Admin |
| PUT | `/api/tasks/:id` | Admin updates task; Member updates assigned task status |
| DELETE | `/api/tasks/:id` | Project Admin |

### Dashboard

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/dashboard` | Returns task totals, status totals, overdue count, and tasks per user |

Dashboard response shape:

```json
{
  "totalTasks": 12,
  "completedTasks": 5,
  "inProgressTasks": 4,
  "todoTasks": 3,
  "overdueTasks": 2,
  "tasksPerUser": []
}
```

## Local Setup

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

## Environment Variables

| Variable | Description |
| --- | --- |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `JWT_SECRET_KEY` | Optional fallback secret if the host does not expose `JWT_SECRET` correctly |
| `PORT` | Server port |
| `NODE_ENV` | Runtime environment |

## Demo Accounts

The database seeds demo users on first run. Each seeded account uses:

```text
Password@123
```

Example Admin login:

```text
aryan@taskora.app
```

## Railway Deployment

1. Push the project to a GitHub repository.
2. Create a Railway project from that repository.
3. Add environment variables in Railway:

```text
JWT_SECRET_KEY=your_strong_secret
NODE_ENV=production
```

4. Railway will run `npm start`.
5. Generate a public domain from Railway networking settings.

The app stores SQLite data in `taskora.db`. For long-term production persistence on Railway, use a managed database such as PostgreSQL.
