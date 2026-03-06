# PropOS Architecture

## Overview

PropOS is a multi-tenant real estate operations platform built for managing
properties, contacts, projects, interactions, and documents across
real estate teams.

## Stack

- **Backend**: Python 3.12 with FastAPI, managed via Poetry
- **Frontend**: React with TypeScript, built with Vite
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with JWT-based session management
- **Storage**: Supabase Storage for document and media uploads
- **Containerization**: Docker and Docker Compose for local development

## Multi-Tenancy

Tenant isolation is enforced at the database level using Supabase
Row Level Security (RLS). Every table includes a tenant identifier,
and RLS policies ensure that users can only read and write data
belonging to their assigned tenant.

## Role-Based Access Control

Five roles govern access across the platform:
ADMIN, AGENT, LANDOWNER, BUYER, and CONTENT.
Each role maps to a set of permissions that restrict which endpoints
and data operations are available.

## Data Flow

1. The frontend authenticates via Supabase Auth and receives a JWT
2. API requests include the JWT in the Authorization header
3. The FastAPI backend validates the token and extracts user context
4. Database queries execute under RLS policies scoped to the tenant
5. Supabase Storage handles file uploads with bucket-level policies

## Project Structure

```
PropOS/
  backend/       FastAPI application and business logic
  frontend/      React + Vite client application
  supabase/      Migrations and Supabase configuration
  config/        Docker and deployment configuration
  scripts/       Build, check, and utility scripts
  bin/           Developer command shortcuts
  etc/           Environment templates and variable lists
  assets/        Brand resources and static assets
  docs/          Project documentation
```

## Local Development

Run `make dev` to start the full stack via Docker Compose.
The API runs on port 8000 and the frontend on port 5173 by default.
Both values are configurable through environment variables.
