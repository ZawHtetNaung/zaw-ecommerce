# Ecommerce Laravel API (Sanctum)

Laravel backend for the React CoreUI admin frontend in `../ecommerce-react`.

## Features
- Auth: register, login, logout
- Password reset: forgot + reset password
- User list API for dashboard
- Category CRUD API
- Sub category CRUD API (single image with drag/drop upload from frontend)
- Color CRUD API (single image, no hex field)
- Measurement CRUD API
- Product CRUD API
- Sanctum Bearer token protection
- Product multiple image upload (stored on public disk)

## Database
This project uses **SQLite**.

- Connection: `sqlite`
- File: `database/database.sqlite`

In `.env`:
```env
DB_CONNECTION=sqlite
DB_DATABASE=/Users/zawhtetnaung/Documents/Webprojects/ecommerce-api/database/database.sqlite
```

## API routes
Public:
- `POST /api/register`
- `POST /api/login`
- `POST /api/forgot-password`
- `POST /api/reset-password`

Protected (`auth:sanctum`):
- `GET /api/user`
- `POST /api/logout`
- `GET /api/users`
- `GET /api/categories`
- `POST /api/categories`
- `GET /api/categories/{id}`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/sub-categories`
- `POST /api/sub-categories`
- `GET /api/sub-categories/{id}`
- `PUT /api/sub-categories/{id}`
- `DELETE /api/sub-categories/{id}`
- `GET /api/colors`
- `POST /api/colors`
- `GET /api/colors/{id}`
- `PUT /api/colors/{id}`
- `DELETE /api/colors/{id}`
- `GET /api/measurements`
- `POST /api/measurements`
- `GET /api/measurements/{id}`
- `PUT /api/measurements/{id}`
- `DELETE /api/measurements/{id}`
- `GET /api/products`
- `POST /api/products`
- `GET /api/products/{id}`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}`

## Start backend
```bash
php artisan migrate --seed
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

## Password reset in local
Mailer is `log`, so reset links are written to `storage/logs/laravel.log`.

## Tests
```bash
php artisan test
```
