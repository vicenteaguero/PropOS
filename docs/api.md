# PropOS API Reference

## Base URL

All endpoints are served under `/api` on the configured `API_URL`.

## Authentication

Every request must include a valid Supabase JWT in the
`Authorization: Bearer <token>` header. Permissions are enforced
based on the authenticated user's role and tenant.

## Endpoints

### Properties

```
GET    /api/properties
GET    /api/properties/{id}
POST   /api/properties
PUT    /api/properties/{id}
DELETE /api/properties/{id}
```

### Contacts

```
GET    /api/contacts
GET    /api/contacts/{id}
POST   /api/contacts
PUT    /api/contacts/{id}
DELETE /api/contacts/{id}
```

### Projects

```
GET    /api/projects
GET    /api/projects/{id}
POST   /api/projects
PUT    /api/projects/{id}
DELETE /api/projects/{id}
```

### Interactions

```
GET    /api/interactions
GET    /api/interactions/{id}
POST   /api/interactions
PUT    /api/interactions/{id}
DELETE /api/interactions/{id}
```

### Documents

```
GET    /api/documents
GET    /api/documents/{id}
POST   /api/documents
PUT    /api/documents/{id}
DELETE /api/documents/{id}
```

### Users

```
GET    /api/users
GET    /api/users/{id}
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}
```
