# Ecommerce React Admin (CoreUI Free)

React frontend using CoreUI free components, connected to Laravel Sanctum API.

## Features
- Register
- Login
- Forgot password
- Reset password
- Admin dashboard (CoreUI)
- User list
- Category CRUD (create, list, edit, delete)
- Sub category CRUD (create, list, edit, delete) with single image drag/drop upload
- Colors CRUD (create, list, edit, delete) with single image drag/drop upload (no hex)
- Measurements CRUD (create, list, edit, delete)
- Product CRUD with split pages:
- `Products -> Create`
- `Products -> List`
- Product supports multiple images upload + drag/drop zone
- Product list supports detail view and edit route
- All listing pages use data tables

## API base URL
Set in `.env`:

```env
VITE_API_BASE_URL=https://api.your-domain.com
```

## Required backend endpoints
- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/user`
- `POST /api/forgot-password`
- `POST /api/reset-password`
- `GET /api/users`
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/sub-categories`
- `POST /api/sub-categories`
- `PUT /api/sub-categories/{id}`
- `DELETE /api/sub-categories/{id}`
- `GET /api/colors`
- `POST /api/colors`
- `PUT /api/colors/{id}`
- `DELETE /api/colors/{id}`
- `GET /api/measurements`
- `POST /api/measurements`
- `PUT /api/measurements/{id}`
- `DELETE /api/measurements/{id}`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}`

## Run
```bash
npm install
npm run dev
```
