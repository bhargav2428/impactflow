# NIMS .NET API

The copied UI is under `v2/`. The API project is a separate ASP.NET Core 9 project at `backend/Nims.Api`. The API has controllers, request/response models, application services, and a durable JSON file data layer. The five role frontends authenticate and read/write through the REST API.

## Run locally

From `v2/backend/Nims.Api`:

```powershell
dotnet run --urls http://localhost:5090
```

Open the interactive Swagger page at `http://localhost:5090/swagger`. The OpenAPI 3 document is available at `http://localhost:5090/swagger/v1/swagger.json` (also `/openapi/v1.json`). The Swagger page loads Swagger UI assets from unpkg, so its UI needs an internet connection; the JSON document and API work without that page.

On first start the API creates `App_Data/nims-store.json` and seeds the demo records. Passwords are PBKDF2 hashes. A random signing key is created in `App_Data/token-signing.key` and reused across restarts. Keep `App_Data` private and out of source control. For a deployed environment, configure a secret of at least 32 characters with `Nims__SigningKey` and protect the data directory.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Network Admin | `admin@nims.test` | `Admin@123` |
| Network Operator | `operator@nims.test` | `Operator@123` |
| Technical Lead | `lead@nims.test` | `Lead@123` |
| Field Engineer | `engineer@nims.test` | `Engineer@123` |
| Customer | `customer@nims.test` | `Customer@123` |

Call `POST /api/auth/login` with `{ "email": "admin@nims.test", "password": "Admin@123" }`, then use the returned `accessToken` as a bearer token in Swagger's **Authorize** dialog or in the `Authorization: Bearer <token>` header. `/api/auth/logout` is a client-side token discard; bearer tokens expire after eight hours.

## API areas

- Authentication and identity: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Role-scoped queues and metrics: `/api/dashboard`, `/api/incidents`, `/api/field-tasks`
- Incident actions: create (customers), notes, escalation (assigned operators), technical validation (leads/admins), resolution
- Infrastructure and accounts: `/api/towers`, `/api/routers`, `/api/users`, `/api/customers`, `/api/sla-policies`
- Workflow support: `/api/notifications`, `/api/audit`, `/api/reports`, `/api/settings`
- Service health: `/api/health`

Admin-only write APIs manage users, customers, towers, routers, and SLA policies. The API checks role and record ownership on the server. Customers can only create incidents against their own mapped router. Engineers can only read and submit reports for field work assigned to them.

## Persistence and scope

The current local database is a JSON document at `backend/Nims.Api/App_Data/nims-store.json`. It persists across restarts, serializes reads and writes within one API process, and writes through a temporary file before replacing the saved document. Keep `App_Data` private and out of source control. The implementation uses no external NuGet packages, so it builds in restricted-network environments.

Services and startup depend on the `INimsStore` persistence boundary, not on the JSON file implementation. To introduce PostgreSQL later, add a PostgreSQL-backed `INimsStore` and switch the dependency registration in `Program.cs`; controllers and current service call sites can remain unchanged. The current interface treats `NimsDatabase` as one unit of work, which is convenient for this local dataset. Before using PostgreSQL at larger scale, replace whole-snapshot reads/writes with query-specific repository operations and add schema migrations and transaction/concurrency handling.

API CORS is limited to loopback browser origins for local UI development.
