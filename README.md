# NIMS frontend

NIMS is a vanilla HTML/CSS/JavaScript network incident management frontend. It uses seeded demo data and LocalStorage, so it can be opened through a static web server without a backend.

## Structure

```text
index.html
login.js
login.css
roles/
  admin/
    index.html
    css/
      styles.css
      role.css
    js/
      app.js
      main.js
      roles/admin.js
      roles/index.js
      shared/
      ...
  operator/
    index.html
    css/
    js/
  lead/
    index.html
    css/
    js/
  engineer/
    index.html
    css/
    js/
  customer/
    index.html
    css/
      styles.css
      role.css
    js/
      app.js
      main.js
      roles/customer.js
      roles/index.js
      shared/
```

The root login is a standalone static page implemented by `login.js` and `login.css`. Each role package contains its own complete HTML entry, CSS, role theme, runtime, dashboard configuration, permissions, role metadata, SLA helpers and LocalStorage helper. There is no root `assets/` runtime and no role package imports another role package.

The login page redirects to `roles/admin/index.html`, `roles/operator/index.html`, `roles/lead/index.html`, `roles/engineer/index.html`, or `roles/customer/index.html`. A role page redirects unauthenticated direct access back to the root login.

## Role page boundaries

- **Network Admin:** infrastructure overview, tower management, router management, user management, customer management, SLA configuration, reports and audit logs. Incident raising, incident handling, escalation and field work are intentionally excluded.
- **Network Operator:** assigned incident queue, investigation notes, status updates, direct resolution for non-escalated incidents, escalation to Technical Lead, notifications and profile settings. Incident creation is intentionally excluded.
- **Technical Lead:** escalations, technical validation, field-service coordination, incidents, notifications and settings.
- **Field Engineer:** assigned field work, repair reports, notifications and settings.
- **Customer:** own incidents, incident creation, own account, notifications and settings.

Direct navigation attempts to pages outside the signed-in role are rejected, and customer incident/detail data is scoped to the customer's mapped router.

## Run

Serve the folder with any static server, then open `index.html`. For example:

```powershell
python -m http.server 8765
```

Open `http://127.0.0.1:8765/index.html`.

The login screen provides demo access for Network Admin, Network Operator, Technical Lead, Field Engineer and Customer. Changes persist in the browser's LocalStorage.

## Demo login accounts

| Role | Email | Password |
|---|---|---|
| Network Admin | `admin@nims.test` | `Admin@123` |
| Network Operator | `operator@nims.test` | `Operator@123` |
| Technical Lead | `lead@nims.test` | `Lead@123` |
| Field Engineer | `engineer@nims.test` | `Engineer@123` |
| Customer | `customer@nims.test` | `Customer@123` |

The login screen also includes a role selector that autofills each demo account.
