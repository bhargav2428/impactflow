
## Run

Start the API and serve the `v2` folder with a static server. Run these in two terminals.

From `v2/backend/Nims.Api`:

```powershell
dotnet run --urls http://127.0.0.1:5090
```

The API creates and seeds its local JSON database in `backend/Nims.Api/App_Data` on first run. Swagger is available at `http://127.0.0.1:5090/swagger`.

From `v2`:

```powershell
python -m http.server 8765
```

Open `http://127.0.0.1:8765/index.html`.

The login screen authenticates against the API. All five demo roles are available. Application data is stored by the API in the local JSON database, not in browser LocalStorage. The frontend defaults to `http://127.0.0.1:5090`; set `window.NIMS_API_BASE_URL` before the module scripts load if the API runs at another address.

The Network Admin creates customer accounts and Operator, Technical Lead and Field Engineer accounts from the management pages. Each account requires an email and password and can then sign in through the same root login. Only Customer accounts can create incidents; other roles can only work within their assigned queues and workflows. Towers and routers use only Active or Deactivated status and do not require IP, MAC or coordinate data. Technical Leads assign field engineers directly from each incident's detail page.

## Demo login accounts

| Role | Email | Password |
|---|---|---|
| Network Admin | `admin@nims.test` | `Admin@123` |
| Network Operator | `operator@nims.test` | `Operator@123` |
| Technical Lead | `lead@nims.test` | `Lead@123` |
| Field Engineer | `engineer@nims.test` | `Engineer@123` |
| Customer | `customer@nims.test` | `Customer@123` |

The login screen also includes a role selector that autofills each demo account.
