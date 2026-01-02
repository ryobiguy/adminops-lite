# AdminOps Lite

Simple MVP for a B2B admin business.

## What it does
- Login (single org, simple)
- Create admin requests
- Move requests across columns: New / Doing / Waiting / Done

## Dev Setup

### 1) API

```bash
npm install
npm run dev
```

### 2) Web

```bash
npm install
npm run dev
```

## Environment variables

### API (`adminops-lite/api/.env`)

- `PORT=5050`
- `JWT_SECRET=change_me`
- `ADMIN_EMAIL=admin@example.com`
- `ADMIN_PASSWORD=change_me`

Create your real local env file by copying:

`adminops-lite/api/.env.example` -> `adminops-lite/api/.env`

### Web (`adminops-lite/web/.env`)

- `VITE_API_URL=http://localhost:5050`

Create your real local env file by copying:

`adminops-lite/web/.env.example` -> `adminops-lite/web/.env`
