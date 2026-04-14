# Empior Node + MySQL Setup

This project uses `dotenv` + `mysql2` to connect a Node.js Express app to MySQL.

## 1) Configure environment variables

Create `.env` in the project root:

```env
PORT=3000

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=admin123
MYSQL_DATABASE=empior_news
MYSQL_CONNECTION_LIMIT=10
```

## 2) Start MySQL server

Use your local MySQL service manager (Windows Services, XAMPP, Docker, etc.) and ensure it is listening on port `3306`.

## 3) Create the database (if needed)

The app auto-creates the database at startup using:

```sql
CREATE DATABASE IF NOT EXISTS empior_news;
```

You can also run it manually in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS empior_news
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

## 4) Start the app

```bash
npm start
```

## Run automated tests

```bash
npm test
```

Test suite coverage currently includes:
- auth token signing/verification
- cookie parsing
- news payload validation rules
- production admin security guardrails

## 5) Test database connection

Open:

```text
http://localhost:3000/test-db
```

Expected success response:

```json
{
  "ok": true,
  "message": "Database connection successful.",
  "data": {
    "reachable": true
  }
}
```

If the connection fails, the API returns clear error details for:
- MySQL not running (`ECONNREFUSED`)
- Invalid credentials (`ER_ACCESS_DENIED_ERROR`)
- Host/port/network issues (`ENOTFOUND`, `ETIMEDOUT`)

## News API

Public routes:

- `GET /api/news` -> returns all published news (latest first)
- `GET /api/news/featured` -> returns one featured news (or latest published fallback)
- `GET /api/news/:slug` -> returns one published news article

Admin routes (authentication required):

- `POST /api/admin/news` -> create news (multipart form with `image`)
- `PUT /api/admin/news/:id` -> update news (multipart form with optional `image`)
- `DELETE /api/admin/news/:id` -> delete news

Validation rules:

- `title` is required
- `category` is required
- `shortDescription` (or `short_description`) is required
- `status` must be `draft` or `published`
- only one article can be `featured` at a time

## Admin Dashboard

Open:

```text
http://localhost:3000/admin-news.html
```

Features:

- admin login/logout
- add news with image upload (`multer`)
- edit news
- delete news
- featured toggle
- draft/published status control

## Production Security Requirements (Admin Auth)

When `NODE_ENV=production`, the app enforces strict admin security checks at startup and exits on insecure config.

Required:
- `ADMIN_USERNAME` must be set and must not be `admin`
- `ADMIN_PASSWORD_HASH` must be provided as a valid 64-char SHA-256 hex string
- `ADMIN_PASSWORD_HASH` must not be the hash of `changeme`
- `ADMIN_PASSWORD` must be empty
- `ADMIN_AUTH_SECRET` must not use the default value and must be at least 32 characters

Generate a password hash:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('your-password').digest('hex'))"
```
