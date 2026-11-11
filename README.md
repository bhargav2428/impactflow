# NIMS frontend

NIMS is a vanilla HTML/CSS/JavaScript network incident management frontend. It uses seeded demo data and LocalStorage, so it can be opened through a static web server without a backend.

## Structure

```text
index.html
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
    js/
assets/
  css/
    styles.css
    roles/
      admin.css
      operator.css
      lead.css
      engineer.css
      customer.css
  js/
    app.js
    role-pages/
      admin.js
      operator.js
      lead.js
      engineer.js
      customer.js
    shared/
      permissions.js
      roles.js
      sla.js
      storage.js
    roles/
      admin.js
      operator.js
      lead.js
      engineer.js
      customer.js
      index.js
```

`app.js` owns shared routing, rendering primitives, forms and workflow actions. Each role module defines its own dashboard configuration and allowed navigation. Each role also has a scoped stylesheet loaded only after that role signs in. Shared modules keep role metadata, permissions, SLA selection and LocalStorage access separate from UI rendering.

Each role is a self-contained package. The login page redirects to `roles/admin/index.html`, `roles/operator/index.html`, `roles/lead/index.html`, `roles/engineer/index.html`, or `roles/customer/index.html`. Every package owns its HTML entry, complete CSS, role theme, application runtime, role dashboard configuration and local shared modules. No role page imports another role page or another role's controller.

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
