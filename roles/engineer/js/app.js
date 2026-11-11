import { roles } from "./shared/roles.js";
import { canAccess } from "./shared/permissions.js";
import { loadState, saveState } from "./shared/storage.js";
import { selectPolicy } from "./shared/sla.js";
import { roleDashboards, roleNavigation } from "./roles/index.js";

const nav = [
  ["dashboard", "Overview", "⌂"],
  ["incidents", "Incidents", "◈"],
  ["create", "Raise incident", "＋"],
  ["infrastructure", "Infrastructure", "⌁"],
  ["escalations", "Escalations", "↗"],
  ["field", "Field service", "⚒"],
  ["towers", "Towers", "▦"],
  ["routers", "Routers", "⌁"],
  ["customers", "Customers", "♙"],
  ["users", "Users", "♚"],
  ["sla", "SLA policies", "◷"],
  ["reports", "Reports", "▥"],
  ["notifications", "Notifications", "◌"],
  ["audit", "Audit log", "◎"],
  ["settings", "Profile & settings", "⚙"]
];

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const date = (value) => new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const cls = (value) => /resolved|operational|active|completed|verified/i.test(value) ? "green" : /critical|breach|degraded|escalated|rejected/i.test(value) ? "red" : /pending|investigating|scheduled|at risk|validation/i.test(value) ? "amber" : "blue";
const badge = (value) => `<span class="badge ${cls(value)}">${esc(value)}</span>`;
const toast = (message, type = "") => {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  document.getElementById("toast-region").append(node);
  setTimeout(() => node.remove(), 3200);
};

function createSeed() {
  const towerNames = [
    ["Koramangala Hub", "Bengaluru"], ["Whitefield East", "Bengaluru"], ["Andheri Central", "Mumbai"],
    ["Salt Lake Sector V", "Kolkata"], ["Hitech City Core", "Hyderabad"]
  ];
  const towers = towerNames.map(([name, location], index) => ({
    id: `TWR-${String(index + 1).padStart(3, "0")}`, name, location,
    status: "Active"
  }));
  const routers = towers.flatMap((tower, towerIndex) => [1, 2, 3].map((number) => ({
    id: `RTR-${towerIndex + 1}${number}0${number}`, towerId: tower.id,
    model: number === 1 ? "Cisco ASR 920" : "Juniper MX204",
    status: "Active"
  })));
  const customerNames = ["Aditi Sharma", "Nexus Retail", "BlueDart Logistics", "Metro Hospitals", "Orbit Finserv", "Kaveri Textiles", "Tata Renewables", "Vistara Foods"];
  const customers = Array.from({ length: 40 }, (_, index) => ({
    id: `CUS-${String(index + 1).padStart(3, "0")}`, name: `${customerNames[index % customerNames.length]}${index > 7 ? ` ${Math.floor(index / 8) + 1}` : ""}`,
    email: `account${index + 1}@example.test`, password: index === 0 ? "Customer@123" : `Customer${index + 1}@123`, phone: `+91 90000 ${String(10000 + index)}`, address: `${10 + index}, Business Park, India`,
    routerId: routers[index % routers.length].id, status: "Active"
  }));
  const policies = [
    { id: "P4", range: "1–10", min: 1, max: 10, response: 4, resolution: 24 },
    { id: "P3", range: "11–50", min: 11, max: 50, response: 2, resolution: 12 },
    { id: "P2", range: "51–200", min: 51, max: 200, response: .5, resolution: 4 },
    { id: "P1", range: "201+", min: 201, max: Infinity, response: 1 / 6, resolution: 1 }
  ];
  const statuses = ["Investigating", "Open", "Escalated", "Resolved", "Pending validation"];
  const incidents = Array.from({ length: 25 }, (_, index) => {
    const router = routers[index % routers.length];
    const affected = customers.filter((customer) => customer.routerId === router.id).length;
    const status = statuses[index % statuses.length];
    const createdAt = new Date(Date.now() - index * 3.75 * 3600000).toISOString();
    const policy = policies.find((item) => affected >= item.min && affected <= item.max) || policies[0];
    return {
      id: `INC-${String(2400 + index).padStart(5, "0")}`, title: ["Packet loss detected", "Intermittent connectivity", "Link unavailable", "High latency alert"][index % 4],
      description: "Customers are reporting service instability across the affected network segment.",
      category: ["Connectivity", "Performance", "Hardware"][index % 3], routerId: router.id, towerId: router.towerId,
      status, priority: policy.id, affected, assignee: ["Priya Nair", "Dev Patel", "Sana Khan"][index % 3],
      createdAt, responseDeadline: new Date(new Date(createdAt).getTime() + policy.response * 3600000).toISOString(),
      resolutionDeadline: new Date(new Date(createdAt).getTime() + policy.resolution * 3600000).toISOString(),
      escalated: ["Escalated", "Pending validation"].includes(status), fieldRequired: index % 7 === 0,
      notes: [{ text: "Incident created and SLA allocated automatically.", author: "System", at: createdAt }],
      timeline: [{ title: "Incident created", actor: "System", at: createdAt }]
    };
  });
  return {
    session: null, page: "dashboard", incidents, towers, routers, customers, policies,
    users: [
      { id: "USR-001", name: "Priya Nair", email: "operator@nims.test", password: "Operator@123", role: "operator", status: "Active" },
      { id: "USR-002", name: "Rahul Iyer", email: "lead@nims.test", password: "Lead@123", role: "lead", status: "Active" },
      { id: "USR-003", name: "Vikram Singh", email: "engineer@nims.test", password: "Engineer@123", role: "engineer", status: "Active" },
      { id: "USR-004", name: "Neeraj Rao", email: "neeraj@nims.test", password: "Engineer@123", role: "engineer", status: "Active" }
    ],
    fieldTasks: [
      { id: "FS-108", incidentId: "INC-02402", engineer: "Vikram Singh", status: "In progress", location: "Salt Lake Sector V", diagnosis: "", report: "" },
      { id: "FS-109", incidentId: "INC-02408", engineer: "Neeraj Rao", status: "Scheduled", location: "Andheri Central", diagnosis: "", report: "" }
    ],
    notifications: [
      { id: "NT-1", title: "P1 SLA breach risk", detail: "INC-02402 needs immediate review.", read: false, at: now() },
      { id: "NT-2", title: "Field report submitted", detail: "FS-109 is ready for validation.", read: false, at: now() }
    ],
    audit: []
  };
}

let state = loadState(createSeed);
state.towers = state.towers.map((tower) => { const clean = { ...tower, status: tower.status === "Active" ? "Active" : "Deactivated" }; delete clean.coordinates; return clean; });
state.routers = state.routers.map((router) => { const clean = { ...router, status: router.status === "Active" ? "Active" : "Deactivated" }; delete clean.ip; delete clean.mac; return clean; });
state.customers = state.customers.map((customer) => ({ ...customer, status: customer.status === "Inactive" ? "Inactive" : "Active" }));
if (window.NIMS_ROLE_PAGE) {
  state.session = window.NIMS_ROLE_PAGE;
  state.authUser = JSON.parse(localStorage.getItem("nims-auth-session") || "null");
  state.page = "dashboard";
  saveState(state);
}
const save = () => saveState(state);
const currentUser = () => state.authUser ? { ...roles[state.session], ...state.authUser } : roles[state.session];
const rolePages = () => roleNavigation[state.session] || [];
const ownsIncident = (incident) => {
  if (state.session === "customer") {
    const account = state.customers.find((customer) => customer.name === currentUser().name);
    return Boolean(account && incident.routerId === account.routerId);
  }
  if (state.session === "operator") return incident.assignee === currentUser().name;
  if (state.session === "lead") return incident.escalated || ["Escalated", "Pending validation"].includes(incident.status);
  return state.session === "admin";
};
const visibleIncidents = () => state.incidents.filter(ownsIncident);
const policyFor = (count) => selectPolicy(state.policies, count);
const log = (title) => { state.audit.unshift({ title, actor: currentUser()?.name || "System", at: now() }); };
const allowed = (page) => {
  return canAccess(page, state.session);
};
const stat = (label, value, trend, tone = "") => `<div class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value ${tone}">${value}</strong><span class="stat-trend">${trend}</span></div>`;
const metric = (label, value, width, tone = "blue") => `<div class="metric-row"><div class="metric-title"><span>${label}</span><strong>${value}</strong></div><div class="bar ${tone}"><span style="width:${Math.max(width, value ? 13 : 3)}%"></span></div></div>`;
const fieldTaskTable = (tasks) => tasks.length
  ? `<div class="table-wrap"><table><thead><tr><th>Request</th><th>Incident</th><th>Status</th></tr></thead><tbody>${tasks.slice(0, 7).map((task) => `<tr><td class="primary-text">${task.id}</td><td>${task.incidentId}</td><td>${badge(task.status)}</td></tr>`).join("")}</tbody></table></div>`
  : `<div class="empty">No field tasks assigned.</div>`;

function navItem(key, label, icon) {
  if (!rolePages().includes(key) || !allowed(key)) return "";
  return `<button class="nav-item ${state.page === key || state.page.startsWith(`${key}:`) ? "active" : ""}" data-page="${key}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`;
}

function shell(content) {
  const unread = state.notifications.filter((item) => !item.read).length;
  return `<div class="app-shell role-${state.session}"><aside class="sidebar"><div class="brand"><div class="brand-mark">N</div><div><strong>NIMS</strong><small>Network operations</small></div></div><nav><div class="nav-label">Workspace</div>${nav.slice(0, 6).map(([key, label, icon]) => navItem(key, label, icon)).join("")}<div class="nav-label">Management</div>${nav.slice(6).map(([key, label, icon]) => navItem(key, label, icon)).join("")}</nav><div class="sidebar-footer"><div class="role-chip">${currentUser().label}</div><button class="nav-item" data-action="logout"><span class="nav-icon">↪</span><span>Sign out</span></button></div></aside><main class="main"><header class="topbar"><span class="crumb">Workspace / <strong>${esc(state.page.split(":")[0])}</strong></span><div class="top-actions"><button class="icon-btn" data-page="notifications" aria-label="Notifications">◌${unread ? `<i class="dot"></i>` : ""}</button><div class="avatar">${currentUser().initials}</div></div></header><section class="content">${content}</section></main></div>`;
}

function pageHead(title, subtitle, action = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p class="subhead">${subtitle}</p></div>${action}</div>`;
}

function dashboard() {
  const config = roleDashboards[state.session];
  const visible = visibleIncidents();
  const action = config.primaryAction === "create" ? "create" : config.primaryAction;
  const hasIncidentWorkspace = rolePages().includes("incidents");
  const dashboardAction = state.session === "admin" ? "infrastructure" : action;
  const dashboardActionLabel = state.session === "admin" ? "View infrastructure" : state.session === "engineer" ? "View field work" : state.session === "lead" ? "Review escalations" : state.session === "customer" ? "Raise incident" : "Open incident queue";
  const stats = config.stats.map(([label, value, trend]) => stat(label, value(state), trend)).join("");
  const panelTitle = state.session === "lead" ? "Escalation workload" : state.session === "engineer" ? "Assigned field work" : state.session === "customer" ? "My recent tickets" : "Incident activity";
  const panelItems = state.session === "lead" ? state.incidents.filter((item) => item.escalated) : state.session === "engineer" ? state.fieldTasks : visible;
  return `${pageHead(config.title, `Good morning, ${currentUser().name.split(" ")[0]}. ${config.subtitle}`, `<button class="btn btn-primary" data-page="${dashboardAction}">＋ ${dashboardActionLabel}</button>`)}<div class="stats">${stats}</div><div class="grid-2"><div class="panel"><div class="panel-head"><h2>${panelTitle}</h2>${hasIncidentWorkspace ? `<button class="panel-link" data-page="${action === "create" ? "incidents" : action}">View all →</button>` : ""}</div>${state.session === "engineer" ? fieldTaskTable(panelItems) : incidentTable(panelItems.slice(0, 7))}</div><div class="panel"><div class="panel-head"><h2>Priority distribution</h2></div><div class="metric-list">${metric("P1 · Critical", visible.filter((i) => i.priority === "P1").length, 100, "red")}${metric("P2 · High", visible.filter((i) => i.priority === "P2").length, 75)}${metric("P3 · Medium", visible.filter((i) => i.priority === "P3").length, 50, "amber")}${metric("P4 · Low", visible.filter((i) => i.priority === "P4").length, 30, "green")}</div></div></div><div class="panel"><div class="panel-head"><h2>Incident activity</h2>${hasIncidentWorkspace ? `<button class="panel-link" data-page="incidents">Open queue →</button>` : ""}</div><div class="chart">${[42, 67, 55, 88, 63, 76, 96].map((height, index) => `<div class="bar-col"><i style="height:${height}%"></i>${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</div>`).join("")}</div></div>`;
}

function incidentTable(items) {
  if (!items.length) return `<div class="empty">No incidents match this view.</div>`;
  const canOpenIncident = rolePages().includes("incidents");
  return `<div class="table-wrap"><table><thead><tr><th>Incident</th><th>Priority</th><th>Status</th><th>Impact</th><th>Assignee</th><th>Updated</th></tr></thead><tbody>${items.map((incident) => `<tr ${canOpenIncident ? `data-incident="${incident.id}" class="clickable"` : ""}><td><span class="primary-text">${incident.id}</span><br><span class="muted">${esc(incident.title)}</span></td><td>${badge(incident.priority)}</td><td>${badge(incident.status)}</td><td>${incident.affected} customers</td><td>${esc(incident.assignee)}</td><td>${date(incident.createdAt)}</td></tr>`).join("")}</tbody></table></div>`;
}

function incidentsView() {
  const controls = `<div class="filters"><input class="search" id="incident-search" placeholder="Search ID, title or assignee"><select class="field" id="status-filter"><option value="">All statuses</option>${["Open", "Investigating", "Escalated", "Pending validation", "Resolved"].map((item) => `<option>${item}</option>`).join("")}</select><select class="field" id="priority-filter"><option value="">All priorities</option>${["P1", "P2", "P3", "P4"].map((item) => `<option>${item}</option>`).join("")}</select><select class="field" id="category-filter"><option value="">All categories</option><option>Connectivity</option><option>Performance</option><option>Hardware</option></select></div>`;
  const action = state.session === "customer" ? `<button class="btn btn-primary" data-page="create">＋ Raise incident</button>` : "";
  return `${pageHead(state.session === "customer" ? "My incidents" : "Incident management", state.session === "customer" ? "Track your own network support tickets and resolutions." : "Search, filter and action the network incident queue.", action)}<div class="panel">${controls}<div id="incident-results">${incidentTable(visibleIncidents())}</div></div>`;
}

function createIncidentView() {
  return `${pageHead("Raise a new incident", "The affected customer count and SLA are calculated automatically.")}<div class="grid-2"><div class="panel"><form id="incident-form"><div class="form-grid"><div class="form-group full"><label>Incident title *</label><input required name="title" class="field" placeholder="e.g. Intermittent connectivity at site"></div><div class="form-group"><label>Category *</label><select name="category" class="field"><option>Connectivity</option><option>Performance</option><option>Hardware</option><option>Planned maintenance</option></select></div><div class="form-group"><label>Impact scope *</label><select name="scope" id="incident-scope" class="field"><option value="router">Router</option><option value="tower">Tower</option><option value="location">Location / other</option></select></div><div class="form-group"><label>Tower</label><select name="towerId" id="incident-tower" class="field">${state.towers.map((tower) => `<option value="${tower.id}">${esc(tower.name)} · ${tower.location}</option>`).join("")}</select></div><div class="form-group"><label>Router</label><select name="routerId" id="incident-router" class="field">${state.routers.map((router) => `<option value="${router.id}">${router.id} · ${router.model}</option>`).join("")}</select></div><div class="form-group full"><label>Description *</label><textarea required name="description" class="field" placeholder="Describe the service problem, symptoms and affected location"></textarea></div><div class="form-group full"><label>Supporting attachment</label><input type="file" name="attachment" class="field"></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-page="incidents">Cancel</button><button class="btn btn-primary">Create incident & calculate SLA</button></div></form></div><div class="panel"><div class="panel-head"><h2>Live SLA preview</h2></div><div id="sla-preview" class="sla-preview"></div></div></div>`;
}

function infrastructureView() {
  return `${pageHead("Network infrastructure", "Explore the live relationship between towers, routers and customers.", `<button class="btn btn-primary" data-action="new-tower">＋ Add tower</button>`)}<div class="stats">${stat("Active towers", state.towers.filter((tower) => tower.status === "Active").length, `of ${state.towers.length} total`)}${stat("Routers", state.routers.length, "Across all sites")}${stat("Mapped customers", state.customers.length, "Customer relationships")}${stat("Deactivated assets", state.towers.filter((tower) => tower.status === "Deactivated").length, "No longer in service", "text-red")}</div><div class="panel"><div class="panel-head"><h2>Topology explorer</h2><span class="muted">${state.towers.length} towers · ${state.routers.length} routers</span></div><div class="infra-tree">${state.towers.map((tower) => `<details class="tree-tower" open><summary>${esc(tower.name)} <span class="muted"> · ${tower.location}</span>${badge(tower.status)} <button class="table-action" data-edit="tower:${tower.id}">Edit</button></summary>${state.routers.filter((router) => router.towerId === tower.id).map((router) => `<div class="tree-router"><strong>${router.id}</strong> · ${router.model} ${badge(router.status)}<div class="customer-pills">${state.customers.filter((customer) => customer.routerId === router.id).map((customer) => `<span class="customer-pill">${esc(customer.name)}</span>`).join("")}</div></div>`).join("")}</details>`).join("")}</div></div>`;
}

function fieldView() {
  const rows = state.fieldTasks.filter((task) => state.session !== "engineer" || task.engineer === currentUser().name);
  return `${pageHead("Field service management", "Create requests, assign engineers and verify repair reports.", `<button class="btn btn-primary" data-action="new-task">＋ New field request</button>`)}<div class="stats">${stat("Open requests", state.fieldTasks.filter((task) => task.status !== "Completed").length, "Across active incidents")}${stat("In progress", state.fieldTasks.filter((task) => task.status === "In progress").length, "Engineers on site")}${stat("Awaiting verification", state.fieldTasks.filter((task) => task.status === "Report submitted").length, "Technical Lead action")}${stat("Engineers active", 3, "of 4 available")}</div><div class="panel"><div class="panel-head"><h2>Field requests</h2></div><div class="table-wrap"><table><thead><tr><th>Request</th><th>Incident</th><th>Engineer</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((task) => `<tr><td class="primary-text">${task.id}</td><td>${task.incidentId}</td><td>${esc(task.engineer)}</td><td>${esc(task.location)}</td><td>${badge(task.status)}</td><td><button class="btn btn-secondary" data-task="${task.id}">${state.session === "engineer" ? "Submit report" : task.status === "Report submitted" ? "Verify report" : "Manage"}</button></td></tr>`).join("")}</tbody></table></div></div>`;
}

function escalationsView() {
  const escalated = state.incidents.filter((incident) => incident.escalated || incident.status === "Escalated" || incident.status === "Pending validation");
  return `${pageHead("Escalation management", "Validate operator escalations and coordinate technical resolution.", `<button class="btn btn-secondary" data-page="incidents">View all incidents</button>`)}<div class="panel"><div class="panel-head"><h2>Escalated incidents</h2><span class="muted">${escalated.length} requiring lead review</span></div>${incidentTable(escalated)}</div>`;
}

function towersView() {
  return `${pageHead("Tower management", "Create, update and monitor network tower assets.", `<button class="btn btn-primary" data-action="new-tower">＋ Create tower</button>`)}<div class="panel"><div class="filters"><input class="search" id="tower-search" placeholder="Search tower, city or ID"><select class="field" id="tower-status"><option value="">All statuses</option><option>Active</option><option>Deactivated</option></select></div><div id="tower-results">${towerTable(state.towers)}</div></div>`;
}
function towerTable(towers) {
  return `<div class="table-wrap"><table><thead><tr><th>Tower</th><th>Location</th><th>Routers</th><th>Customers</th><th>Status</th><th>Actions</th></tr></thead><tbody>${towers.map((tower) => `<tr><td><span class="primary-text">${tower.id}</span><br>${esc(tower.name)}</td><td>${esc(tower.location)}</td><td>${state.routers.filter((router) => router.towerId === tower.id).length}</td><td>${state.customers.filter((customer) => state.routers.filter((router) => router.towerId === tower.id).some((router) => router.id === customer.routerId)).length}</td><td>${badge(tower.status)}</td><td><button class="table-action" data-edit="tower:${tower.id}">Edit</button><button class="table-action danger" data-delete="tower:${tower.id}">Deactivate</button></td></tr>`).join("")}</tbody></table></div>`;
}

function routersView() {
  return `${pageHead("Router management", "Maintain router models and tower associations.", `<button class="btn btn-primary" data-action="new-router">＋ Create router</button>`)}<div class="panel"><div class="filters"><input class="search" id="router-search" placeholder="Search router or model"><select class="field" id="router-status"><option value="">All statuses</option><option>Active</option><option>Deactivated</option></select></div><div id="router-results">${routerTable(state.routers)}</div></div>`;
}
function routerTable(routers) {
  return `<div class="table-wrap"><table><thead><tr><th>Router</th><th>Model</th><th>Tower</th><th>Customers</th><th>Status</th><th>Actions</th></tr></thead><tbody>${routers.map((router) => `<tr><td class="primary-text">${router.id}</td><td>${router.model}</td><td>${esc(state.towers.find((tower) => tower.id === router.towerId)?.name)}</td><td>${state.customers.filter((customer) => customer.routerId === router.id).length}</td><td>${badge(router.status)}</td><td><button class="table-action" data-edit="router:${router.id}">Edit</button><button class="table-action danger" data-delete="router:${router.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
}

function customersView() {
  const own = state.session === "customer" ? state.customers.filter((customer) => customer.name === currentUser().name) : state.customers;
  return `${pageHead(state.session === "customer" ? "My account" : "Customer management", "Manage customer accounts, mappings and incident history.", state.session === "admin" ? `<button class="btn btn-primary" data-action="new-customer">＋ Create customer</button>` : "")}<div class="panel"><div class="filters"><input class="search" id="customer-search" placeholder="Search customer, email or ID"><select class="field" id="customer-status"><option value="">All statuses</option><option>Active</option><option>Inactive</option></select></div><div id="customer-results">${customerTable(own)}</div></div>`;
}
function customerTable(customers) {
  return `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Mapped router</th><th>Tower</th><th>Incidents</th><th>Status</th><th>Action</th></tr></thead><tbody>${customers.map((customer) => { const router = state.routers.find((item) => item.id === customer.routerId); return `<tr><td><span class="primary-text">${esc(customer.id)}</span><br>${esc(customer.name)}</td><td>${customer.email}<br>${customer.phone}</td><td>${router?.id}</td><td>${esc(state.towers.find((tower) => tower.id === router?.towerId)?.name)}</td><td>${state.incidents.filter((incident) => incident.routerId === customer.routerId).length}</td><td>${badge(customer.status)}</td><td><button class="table-action" data-edit="customer:${customer.id}">View</button></td></tr>`; }).join("")}</tbody></table></div>`;
}

function usersView() {
  return `${pageHead("User management", "Manage roles, assignments and account access.", `<button class="btn btn-primary" data-action="new-user">＋ Add user</button>`)}<div class="panel"><div class="table-wrap"><table><thead><tr><th>User</th><th>Contact</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.users.map((user) => `<tr><td><span class="primary-text">${user.id}</span><br>${esc(user.name)}</td><td>${user.email}</td><td>${roles[user.role]?.label || user.role}</td><td>${badge(user.status)}</td><td><button class="table-action" data-edit="user:${user.id}">Edit</button><button class="table-action danger" data-delete="user:${user.id}">Deactivate</button></td></tr>`).join("")}</tbody></table></div></div>`;
}

function slaView() {
  return `${pageHead("SLA configuration", "Configure automatic priority and response/resolution thresholds.", `<button class="btn btn-primary" data-action="new-policy">＋ Add policy</button>`)}<div class="panel"><div class="notice"><strong>Allocation is immutable after incident creation.</strong> Operators and customers cannot manually change an incident SLA.</div><div class="table-wrap"><table><thead><tr><th>Priority</th><th>Customer impact</th><th>Response time</th><th>Resolution time</th><th>Actions</th></tr></thead><tbody>${state.policies.map((policy) => `<tr><td>${badge(policy.id)}</td><td>${policy.range} customers</td><td>${policy.response < 1 ? `${policy.response * 60} minutes` : `${policy.response} hours`}</td><td>${policy.resolution} hours</td><td><button class="table-action" data-edit="policy:${policy.id}">Edit</button></td></tr>`).join("")}</tbody></table></div></div>`;
}

function reportsView() {
  const resolved = state.incidents.filter((incident) => incident.status === "Resolved").length;
  return `${pageHead("Reports & analytics", "Measure service quality, SLA performance and operational load.", `<button class="btn btn-secondary" data-action="export">⇩ Export CSV</button>`)}<div class="stats">${stat("SLA compliance", "96.8%", "↑ 2.4% this period")}${stat("MTTR", "3h 42m", "↓ 18m vs last month")}${stat("First response", "18m", "↓ 6m vs last month")}${stat("Resolved incidents", resolved, "Current dataset")}</div><div class="grid-2"><div class="panel"><div class="panel-head"><h2>Resolution trend</h2><span class="muted">Last 7 periods</span></div><div class="chart">${[78, 70, 65, 60, 53, 49, 42].map((height, index) => `<div class="bar-col"><i style="height:${height}%"></i>W${index + 1}</div>`).join("")}</div></div><div class="panel"><div class="panel-head"><h2>Incident categories</h2></div><div class="metric-list">${metric("Connectivity", state.incidents.filter((i) => i.category === "Connectivity").length, 86)}${metric("Performance", state.incidents.filter((i) => i.category === "Performance").length, 58, "amber")}${metric("Hardware", state.incidents.filter((i) => i.category === "Hardware").length, 33, "green")}</div></div></div><div class="panel"><div class="panel-head"><h2>Operational summary</h2></div>${incidentTable(state.incidents.slice(0, 8))}</div>`;
}

function notificationsView() {
  return `${pageHead("Notifications", "Alerts, workflow changes and service updates.")}<div class="panel">${state.notifications.length ? state.notifications.map((item) => `<div class="notification ${item.read ? "read" : ""}" data-notification="${item.id}"><div class="notification-icon">◌</div><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>${date(item.at)}</small></div>${item.read ? "" : `<span class="unread-dot"></span>`}</div>`).join("") : `<div class="empty">You are all caught up.</div>`}</div>`;
}

function auditView() {
  return `${pageHead("Audit log", "A traceable history of administrative and workflow actions.")}<div class="panel"><div class="timeline">${state.audit.concat([{ title: "Workspace initialized", actor: "System", at: now() }]).slice(0, 30).map((item) => `<div class="timeline-item"><i class="timeline-dot"></i><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-meta">${esc(item.actor)} · ${date(item.at)}</div></div></div>`).join("")}</div></div>`;
}

function settingsView() {
  return `${pageHead("Profile & settings", "Manage your demo profile and workspace preferences.")}<div class="grid-2"><div class="panel"><div class="panel-head"><h2>Profile</h2></div><div class="form-grid"><div class="form-group"><label>Full name</label><input class="field" value="${currentUser().name}"></div><div class="form-group"><label>Role</label><input disabled class="field" value="${currentUser().label}"></div><div class="form-group"><label>Email</label><input class="field" value="${currentUser().name.toLowerCase().replace(" ", ".")}@example.test"></div><div class="form-group"><label>Timezone</label><select class="field"><option>Asia/Kolkata (IST)</option></select></div></div><div class="form-actions"><button class="btn btn-primary" data-action="save-settings">Save changes</button></div></div><div class="panel"><div class="panel-head"><h2>Workspace preferences</h2></div><label class="check-row"><input type="checkbox" checked> Notify me about SLA warnings</label><label class="check-row"><input type="checkbox" checked> Email field service updates</label><label class="check-row"><input type="checkbox"> Compact data tables</label></div></div>`;
}

function incidentDetail(incidentId) {
  const incident = state.incidents.find((item) => item.id === incidentId);
  if (!incident || !ownsIncident(incident) || !rolePages().includes("incidents")) return simple("Incident not found", "This incident is not available in your role workspace.", `<button class="btn btn-primary" data-page="dashboard">Back to dashboard</button>`);
  const router = state.routers.find((item) => item.id === incident.routerId);
  const tower = state.towers.find((item) => item.id === incident.towerId);
  const policy = state.policies.find((item) => item.id === incident.priority) || policyFor(incident.affected);
  const canClose = incident.status !== "Resolved" && ((state.session === "operator" && !incident.escalated) || state.session === "lead" || state.session === "admin");
  const isLead = state.session === "lead";
  const assignedTask = state.fieldTasks.find((task) => task.incidentId === incident.id);
  return `${pageHead(`${incident.id} · ${esc(incident.title)}`, `${esc(tower?.name)} · Created ${date(incident.createdAt)}`, `<button class="btn btn-secondary" data-page="incidents">← Back</button>`)}<div class="detail-actions">${badge(incident.status)}${incident.status !== "Resolved" ? `<button class="btn btn-secondary" data-action="add-note" data-id="${incident.id}">＋ Add note</button>` : ""}${state.session === "operator" && !incident.escalated && incident.status !== "Resolved" ? `<button class="btn btn-secondary" data-action="escalate" data-id="${incident.id}">Escalate to lead</button>` : ""}${canClose ? `<button class="btn btn-primary" data-action="close-incident" data-id="${incident.id}">${incident.escalated ? "Lead close incident" : "Resolve incident"}</button>` : ""}</div><div class="grid-2"><div><div class="panel"><div class="panel-head"><h2>Incident overview</h2>${badge(incident.priority)}</div><div class="detail-grid"><div><span class="muted">Category</span><strong>${incident.category}</strong></div><div><span class="muted">Assigned operator</span><strong>${incident.assignee}</strong></div><div><span class="muted">Affected customers</span><strong>${incident.affected}</strong></div><div><span class="muted">SLA allocation</span><strong>${policy.id} · ${policy.resolution}h resolution</strong></div><div class="wide"><span class="muted">Description</span><strong>${esc(incident.description)}</strong></div></div></div><div class="panel"><div class="panel-head"><h2>Troubleshooting notes</h2></div>${incident.notes.map((note) => `<div class="note"><strong>${esc(note.author)}</strong><span>${date(note.at)}</span><p>${esc(note.text)}</p></div>`).join("")}</div><div class="panel"><div class="panel-head"><h2>Customer impact</h2></div>${state.customers.filter((customer) => customer.routerId === incident.routerId).map((customer) => `<div class="impact-row"><strong>${esc(customer.name)}</strong><span>${customer.email}</span>${badge(customer.status)}</div>`).join("") || `<div class="empty">No directly mapped customers.</div>`}</div></div><div><div class="panel"><div class="panel-head"><h2>SLA monitor</h2></div>${metric("Response deadline", 80, 80, "green")}${metric("Resolution deadline", incident.status === "Escalated" ? 92 : 56, incident.status === "Escalated" ? 92 : 56, incident.status === "Escalated" ? "red" : "blue")}<p class="muted sla-copy">Response: ${policy.response < 1 ? `${policy.response * 60} minutes` : `${policy.response} hours`} · Resolution: ${policy.resolution} hours<br>Response deadline: ${date(incident.responseDeadline)}<br>Resolution deadline: ${date(incident.resolutionDeadline)}</p></div><div class="panel"><div class="panel-head"><h2>Incident timeline</h2></div><div class="timeline">${incident.timeline.map((item) => `<div class="timeline-item"><i class="timeline-dot"></i><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-meta">${esc(item.actor)} · ${date(item.at)}</div></div></div>`).join("")}</div></div>${isLead ? `<div class="panel"><div class="panel-head"><h2>Field assignment</h2></div><p class="muted">${assignedTask ? `Assigned to ${esc(assignedTask.engineer)} · ${esc(assignedTask.status)}` : "Assign a field engineer directly from this incident."}</p><button class="btn btn-primary" data-action="new-task" data-incident="${incident.id}">${assignedTask ? "Change field engineer" : "Assign field engineer"}</button></div>` : ""}</div></div>`;
}

function simple(title, subtitle, body) { return `${pageHead(title, subtitle)}<div class="panel">${body}</div>`; }

function formModal(title, form) { return `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="close" data-action="close-modal">×</button></div>${form}</div></div>`; }
function towerForm(existing = {}) {
  return formModal(existing.id ? "Edit tower" : "Create tower", `<form id="tower-form" data-id="${existing.id || ""}"><div class="form-grid"><div class="form-group"><label>Tower name *</label><input required name="name" class="field" value="${esc(existing.name)}"></div><div class="form-group"><label>Location *</label><input required name="location" class="field" value="${esc(existing.location)}"></div><div class="form-group"><label>Status</label><select name="status" class="field"><option ${existing.status !== "Deactivated" ? "selected" : ""}>Active</option><option ${existing.status === "Deactivated" ? "selected" : ""}>Deactivated</option></select></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save tower</button></div></form>`);
}
function routerForm(existing = {}) {
  return formModal(existing.id ? "Edit router" : "Create router", `<form id="router-form" data-id="${existing.id || ""}"><div class="form-grid"><div class="form-group"><label>Router ID *</label><input required name="id" class="field" value="${esc(existing.id || "")}"></div><div class="form-group"><label>Model *</label><input required name="model" class="field" value="${esc(existing.model || "Cisco ASR 920")}"></div><div class="form-group"><label>Associated tower *</label><select name="towerId" class="field">${state.towers.map((tower) => `<option value="${tower.id}" ${tower.id === existing.towerId ? "selected" : ""}>${esc(tower.name)}</option>`).join("")}</select></div><div class="form-group"><label>Status</label><select name="status" class="field"><option ${existing.status !== "Deactivated" ? "selected" : ""}>Active</option><option ${existing.status === "Deactivated" ? "selected" : ""}>Deactivated</option></select></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save router</button></div></form>`);
}
function incidentModal() {
  return formModal("Create network incident", `<form id="incident-form"><div class="form-grid"><div class="form-group full"><label>Incident title *</label><input required name="title" class="field" placeholder="Describe the issue"></div><div class="form-group"><label>Category</label><select name="category" class="field"><option>Connectivity</option><option>Performance</option><option>Hardware</option></select></div><div class="form-group"><label>Impact scope</label><select name="scope" id="incident-scope" class="field"><option value="router">Router</option><option value="tower">Tower</option></select></div><div class="form-group"><label>Tower</label><select name="towerId" id="incident-tower" class="field">${state.towers.map((tower) => `<option value="${tower.id}">${esc(tower.name)}</option>`).join("")}</select></div><div class="form-group"><label>Router</label><select name="routerId" id="incident-router" class="field">${state.routers.map((router) => `<option value="${router.id}">${router.id} · ${router.ip}</option>`).join("")}</select></div><div class="form-group full"><label>Description *</label><textarea required name="description" class="field" placeholder="Describe the problem"></textarea></div><div class="form-group full"><label>Supporting attachment</label><input type="file" class="field"></div></div><div id="modal-sla-preview" class="notice"></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Create incident</button></div></form>`);
}
function userForm(existing = {}) {
  const labels = { operator: "Network Operator", lead: "Technical Lead", engineer: "Field Engineer" };
  return formModal(existing.id ? "Edit user" : "Create user", `<form id="user-form" data-id="${existing.id || ""}"><div class="form-grid"><div class="form-group"><label>Full name *</label><input required name="name" class="field" value="${esc(existing.name || "")}"></div><div class="form-group"><label>Email *</label><input required type="email" name="email" class="field" value="${esc(existing.email || "")}"></div><div class="form-group"><label>Password *</label><input required type="password" name="password" class="field" value="${esc(existing.password || "")}" minlength="8"></div><div class="form-group"><label>Role</label><select name="role" class="field">${Object.entries(labels).map(([role, label]) => `<option value="${role}" ${role === existing.role ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="form-group"><label>Status</label><select name="status" class="field"><option>Active</option><option ${existing.status === "Inactive" ? "selected" : ""}>Inactive</option></select></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save user</button></div></form>`);
}
function customerForm(existing = {}) {
  return formModal(existing.id ? "Edit customer" : "Create customer account", `<form id="customer-form" data-id="${existing.id || ""}"><div class="form-grid"><div class="form-group"><label>Customer name *</label><input required name="name" class="field" value="${esc(existing.name || "")}"></div><div class="form-group"><label>Email *</label><input required type="email" name="email" class="field" value="${esc(existing.email || "")}"></div><div class="form-group"><label>Password *</label><input required type="password" name="password" class="field" value="${esc(existing.password || "")}" minlength="8"></div><div class="form-group"><label>Phone</label><input name="phone" class="field" value="${esc(existing.phone || "")}"></div><div class="form-group"><label>Account status</label><select name="status" class="field"><option ${existing.status !== "Inactive" ? "selected" : ""}>Active</option><option ${existing.status === "Inactive" ? "selected" : ""}>Inactive</option></select></div><div class="form-group full"><label>Address</label><input name="address" class="field" value="${esc(existing.address || "")}"></div><div class="form-group full"><label>Associated router *</label><select required name="routerId" class="field">${state.routers.map((router) => `<option value="${router.id}" ${router.id === existing.routerId ? "selected" : ""}>${router.id} · ${router.model}</option>`).join("")}</select></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save customer</button></div></form>`);
}
function taskForm(incidentId = "") {
  const incident = state.incidents.find((item) => item.id === incidentId) || state.incidents.find((item) => item.escalated);
  return formModal(incident ? "Assign field engineer" : "Create field-service request", `<form id="task-form"><input type="hidden" name="incidentId" value="${incident?.id || ""}"><div class="form-grid"><div class="form-group"><label>Incident</label><select name="incidentId" class="field" ${incident ? "disabled" : ""}>${state.incidents.filter((item) => item.status !== "Resolved").map((item) => `<option value="${item.id}" ${item.id === incident?.id ? "selected" : ""}>${item.id} · ${esc(item.title)}</option>`).join("")}</select></div><div class="form-group"><label>Assign engineer</label><select name="engineer" class="field">${state.users.filter((user) => user.role === "engineer" && user.status === "Active").map((user) => `<option ${user.name === state.fieldTasks.find((task) => task.incidentId === incident?.id)?.engineer ? "selected" : ""}>${esc(user.name)}</option>`).join("")}</select></div><div class="form-group full"><label>Visit instructions</label><textarea name="instructions" class="field" placeholder="Access notes, equipment and safety information">${esc(state.fieldTasks.find((task) => task.incidentId === incident?.id)?.instructions || "")}</textarea></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save assignment</button></div></form>`);
}
function noteForm() {
  return formModal("Add troubleshooting note", `<form id="note-form"><div class="form-group"><label>Note *</label><textarea required name="note" class="field" placeholder="Add investigation details"></textarea></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save note</button></div></form>`);
}
function policyForm(existing = {}) {
  return formModal(existing.id ? "Edit SLA policy" : "Create SLA policy", `<form id="policy-form" data-id="${existing.id || ""}"><div class="form-grid"><div class="form-group"><label>Priority</label><select name="id" class="field"><option ${existing.id === "P1" ? "selected" : ""}>P1</option><option ${existing.id === "P2" ? "selected" : ""}>P2</option><option ${existing.id === "P3" ? "selected" : ""}>P3</option><option ${existing.id === "P4" ? "selected" : ""}>P4</option></select></div><div class="form-group"><label>Range label</label><input required name="range" class="field" value="${esc(existing.range || "")}" placeholder="1–10"></div><div class="form-group"><label>Minimum customers</label><input required type="number" min="1" name="min" class="field" value="${existing.min || 1}"></div><div class="form-group"><label>Maximum customers</label><input required type="number" min="1" name="max" class="field" value="${existing.max === Infinity ? 99999 : existing.max || 10}"></div><div class="form-group"><label>Response hours</label><input required type="number" step=".1" min=".1" name="response" class="field" value="${existing.response || 1}"></div><div class="form-group"><label>Resolution hours</label><input required type="number" step=".1" min=".1" name="resolution" class="field" value="${existing.resolution || 4}"></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save policy</button></div></form>`);
}

function render() {
  if (!state.session) {
    window.location.href = "../../index.html";
    return;
  }
  if (!rolePages().includes(state.page.split(":")[0]) && !state.page.startsWith("detail:")) state.page = "dashboard";
  const accessPage = state.page.startsWith("detail:") ? "incidents" : state.page.split(":")[0];
  if (!allowed(accessPage)) state.page = "dashboard";
  let content = state.page === "dashboard" ? dashboard()
    : state.page === "incidents" ? incidentsView()
    : state.page === "create" ? createIncidentView()
    : state.page === "infrastructure" ? infrastructureView()
    : state.page === "escalations" ? escalationsView()
    : state.page === "field" ? fieldView()
    : state.page === "towers" ? towersView()
    : state.page === "routers" ? routersView()
    : state.page === "customers" ? customersView()
    : state.page === "users" ? usersView()
    : state.page === "sla" ? slaView()
    : state.page === "reports" ? reportsView()
    : state.page === "notifications" ? notificationsView()
    : state.page === "audit" ? auditView()
    : state.page === "settings" ? settingsView()
    : state.page.startsWith("detail:") ? incidentDetail(state.page.split(":")[1])
    : dashboard();
  document.getElementById("app").innerHTML = shell(content);
  updateSlaPreview();
}

function updateSlaPreview() {
  const scope = document.getElementById("incident-scope");
  const router = document.getElementById("incident-router");
  const tower = document.getElementById("incident-tower");
  if (!scope || !router || !tower) return;
  const routerId = router.value;
  const towerId = tower.value;
  const count = scope.value === "tower"
    ? state.customers.filter((customer) => state.routers.filter((item) => item.towerId === towerId).some((item) => item.id === customer.routerId)).length
    : state.customers.filter((customer) => customer.routerId === routerId).length;
  const policy = policyFor(count);
  const html = `<strong>${count} affected customers → ${policy.id} policy</strong><br>Response: ${policy.response < 1 ? `${policy.response * 60} minutes` : `${policy.response} hours`} · Resolution: ${policy.resolution} hours`;
  (document.getElementById("sla-preview") || document.getElementById("modal-sla-preview")).innerHTML = html;
}

function createIncident(form) {
  if (state.session !== "customer") {
    toast("Only customers can create incidents", "error");
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  const router = state.routers.find((item) => item.id === data.routerId);
  const tower = state.towers.find((item) => item.id === data.towerId);
  if (!router || !tower) return toast("Select a valid network asset", "error");
  const affected = data.scope === "tower"
    ? state.customers.filter((customer) => state.routers.filter((item) => item.towerId === tower.id).some((item) => item.id === customer.routerId)).length
    : state.customers.filter((customer) => customer.routerId === router.id).length;
  const policy = policyFor(affected);
  const createdAt = now();
  const incident = {
    id: id("INC"), title: data.title, description: data.description, category: data.category, scope: data.scope,
    routerId: router.id, towerId: tower.id, affected, priority: policy.id, status: "Open", assignee: "Priya Nair",
    createdAt, responseDeadline: new Date(Date.now() + policy.response * 3600000).toISOString(),
    resolutionDeadline: new Date(Date.now() + policy.resolution * 3600000).toISOString(), escalated: false, fieldRequired: false,
    notes: [{ text: "Incident created and SLA allocated automatically.", author: currentUser().name, at: createdAt }],
    timeline: [{ title: `Incident created · ${policy.id} SLA allocated`, actor: currentUser().name, at: createdAt }]
  };
  state.incidents.unshift(incident); log(`Created ${incident.id} with ${policy.id} SLA`); state.notifications.unshift({ id: id("NT"), title: "New incident created", detail: `${incident.id} is available in the operator queue.`, read: false, at: createdAt }); save();
  document.getElementById("modal")?.remove(); toast(`${incident.id} created with ${policy.id} SLA`); state.page = `detail:${incident.id}`; render();
}

function saveTower(form) {
  const data = Object.fromEntries(new FormData(form));
  if (form.dataset.id) Object.assign(state.towers.find((tower) => tower.id === form.dataset.id), data);
  else state.towers.push({ ...data, id: id("TWR") });
  log(`${form.dataset.id ? "Updated" : "Created"} tower ${form.dataset.id || state.towers.at(-1).id}`); save(); document.getElementById("modal")?.remove(); toast("Tower saved"); render();
}
function saveRouter(form) {
  const data = Object.fromEntries(new FormData(form));
  if (form.dataset.id) Object.assign(state.routers.find((router) => router.id === form.dataset.id), data);
  else state.routers.push(data);
  log(`${form.dataset.id ? "Updated" : "Created"} router ${data.id}`); save(); document.getElementById("modal")?.remove(); toast("Router saved"); render();
}
function saveUser(form) {
  const data = Object.fromEntries(new FormData(form));
  if (form.dataset.id) Object.assign(state.users.find((user) => user.id === form.dataset.id), data);
  else state.users.push({ ...data, id: id("USR") });
  log(`${form.dataset.id ? "Updated" : "Created"} user ${data.name}`); save(); document.getElementById("modal")?.remove(); toast("User saved"); render();
}
function savePolicy(form) {
  const data = Object.fromEntries(new FormData(form));
  const policy = { ...data, min: Number(data.min), max: Number(data.max), response: Number(data.response), resolution: Number(data.resolution) };
  if (form.dataset.id) Object.assign(state.policies.find((item) => item.id === form.dataset.id), policy);
  else state.policies.push(policy);
  state.policies.sort((a, b) => a.min - b.min); log(`Updated SLA policy ${policy.id}`); save(); document.getElementById("modal")?.remove(); toast("SLA policy saved"); render();
}
function updateTask(task) {
  if (state.session === "engineer") return formModal("Submit field report", `<form id="report-form" data-id="${task.id}"><div class="form-group"><label>Visit status</label><select name="status" class="field"><option>In progress</option><option>Report submitted</option></select></div><div class="form-group"><label>Diagnosis and repair report *</label><textarea required name="report" class="field">${esc(task.report)}</textarea></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Submit report</button></div></form>`);
  if (task.status === "Report submitted" && (state.session === "lead" || state.session === "admin")) return formModal("Verify field report", `<form id="verify-form" data-id="${task.id}"><p class="muted">${esc(task.report || "No report text supplied.")}</p><div class="form-actions"><button class="btn btn-danger" data-action="reject-task" data-id="${task.id}">Reject</button><button class="btn btn-primary">Verify & complete</button></div></form>`);
  return formModal("Update field request", `<form id="task-update-form" data-id="${task.id}"><div class="form-group"><label>Status</label><select name="status" class="field"><option>Scheduled</option><option>In progress</option><option>Report submitted</option></select></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary">Update</button></div></form>`);
}

document.addEventListener("click", (event) => {
  const page = event.target.closest("[data-page]")?.dataset.page;
  if (page) {
    if (!rolePages().includes(page) || !allowed(page)) {
      toast("This page is not available for your role", "error");
      return;
    }
    state.page = page; save(); render(); return;
  }
  const incidentRow = event.target.closest("tr[data-incident]");
  if (incidentRow) { state.page = `detail:${incidentRow.dataset.incident}`; save(); render(); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "logout") {
    state.session = null;
    save();
    window.location.href = "../../index.html";
    return;
  }
  if (action === "close-modal") { document.getElementById("modal")?.remove(); return; }
  if (action === "new-tower") { openModal(towerForm()); return; }
  if (action === "new-router") { openModal(routerForm()); return; }
  if (action === "new-user") { openModal(userForm()); return; }
  if (action === "new-policy") { openModal(policyForm()); return; }
  if (action === "new-customer") { openModal(customerForm()); return; }
  if (action === "new-task") {
    const taskAction = event.target.closest("[data-action]");
    openModal(taskForm(taskAction?.dataset.incident || ""));
    return;
  }
  if (action === "add-note") { document.getElementById("modal")?.remove(); openModal(noteForm()); document.getElementById("note-form").dataset.id = event.target.closest("[data-action]").dataset.id; return; }
  if (action === "escalate") { const incident = state.incidents.find((item) => item.id === event.target.closest("[data-action]").dataset.id); incident.status = "Escalated"; incident.escalated = true; incident.timeline.push({ title: "Escalated to Technical Lead", actor: currentUser().name, at: now() }); log(`Escalated ${incident.id}`); save(); toast("Incident escalated to Technical Lead"); render(); return; }
  if (action === "close-incident") { const incident = state.incidents.find((item) => item.id === event.target.closest("[data-action]").dataset.id); incident.status = "Resolved"; incident.timeline.push({ title: "Incident resolved and closed", actor: currentUser().name, at: now() }); log(`Closed ${incident.id}`); save(); toast("Incident resolved"); render(); return; }
  if (action === "validate") { const incident = state.incidents.find((item) => item.id === event.target.closest("[data-action]").dataset.id); incident.status = "Pending validation"; incident.timeline.push({ title: "Technical validation completed", actor: currentUser().name, at: now() }); log(`Validated ${incident.id}`); save(); toast("Technical validation recorded"); render(); return; }
  if (action === "export") { const csv = ["Incident,Title,Priority,Status,Affected customers", ...state.incidents.map((item) => `${item.id},"${item.title}",${item.priority},${item.status},${item.affected}`)].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "nims-incidents.csv"; link.click(); toast("CSV export downloaded"); return; }
  if (action === "save-settings") { toast("Settings saved"); return; }
  const edit = event.target.closest("[data-edit]")?.dataset.edit;
  if (edit) { const [type, value] = edit.split(":"); const item = type === "tower" ? state.towers.find((tower) => tower.id === value) : type === "router" ? state.routers.find((router) => router.id === value) : type === "user" ? state.users.find((user) => user.id === value) : type === "policy" ? state.policies.find((policy) => policy.id === value) : state.customers.find((customer) => customer.id === value); openModal(type === "tower" ? towerForm(item) : type === "router" ? routerForm(item) : type === "user" ? userForm(item) : type === "policy" ? policyForm(item) : customerForm(item)); return; }
  const deletion = event.target.closest("[data-delete]")?.dataset.delete;
  if (deletion && window.confirm("Deactivate this record?")) { const [type, value] = deletion.split(":"); if (type === "tower") state.towers.find((tower) => tower.id === value).status = "Deactivated"; if (type === "router") state.routers.find((router) => router.id === value).status = "Deactivated"; if (type === "user") state.users.find((user) => user.id === value).status = "Inactive"; log(`Deactivated ${value}`); save(); toast("Record updated"); render(); return; }
  const taskId = event.target.closest("[data-task]")?.dataset.task;
  if (taskId) { openModal(updateTask(state.fieldTasks.find((task) => task.id === taskId))); return; }
  const notification = event.target.closest("[data-notification]")?.dataset.notification;
  if (notification) { state.notifications.find((item) => item.id === notification).read = true; save(); render(); }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "incident-form") createIncident(event.target);
  if (event.target.id === "tower-form") saveTower(event.target);
  if (event.target.id === "router-form") saveRouter(event.target);
  if (event.target.id === "user-form") saveUser(event.target);
  if (event.target.id === "customer-form") {
    const data = Object.fromEntries(new FormData(event.target));
    if (event.target.dataset.id) Object.assign(state.customers.find((customer) => customer.id === event.target.dataset.id), data);
    else state.customers.push({ ...data, id: id("CUS") });
    log(`${event.target.dataset.id ? "Updated" : "Created"} customer ${data.name}`);
    save(); document.getElementById("modal")?.remove(); toast("Customer account saved"); render();
  }
  if (event.target.id === "policy-form") savePolicy(event.target);
  if (event.target.id === "note-form") { const incident = state.incidents.find((item) => item.id === event.target.dataset.id); const data = Object.fromEntries(new FormData(event.target)); incident.notes.push({ text: data.note, author: currentUser().name, at: now() }); incident.timeline.push({ title: "Troubleshooting note added", actor: currentUser().name, at: now() }); log(`Added note to ${incident.id}`); save(); document.getElementById("modal")?.remove(); toast("Note added"); render(); }
  if (event.target.id === "task-form") { const data = Object.fromEntries(new FormData(event.target)); const incident = state.incidents.find((item) => item.id === data.incidentId); const existing = state.fieldTasks.find((task) => task.incidentId === data.incidentId); if (existing) { Object.assign(existing, { engineer: data.engineer, instructions: data.instructions }); incident.timeline.push({ title: "Field engineer assignment updated", actor: currentUser().name, at: now() }); log(`Updated field assignment for ${incident.id}`); } else { state.fieldTasks.push({ id: id("FS"), incidentId: data.incidentId, engineer: data.engineer, status: "Scheduled", location: state.towers.find((tower) => tower.id === incident.towerId)?.location || "Network site", diagnosis: "", report: "", instructions: data.instructions }); incident.fieldRequired = true; incident.timeline.push({ title: "Field-service request created", actor: currentUser().name, at: now() }); log(`Created field request for ${incident.id}`); } save(); document.getElementById("modal")?.remove(); toast("Field assignment saved"); render(); }
  if (event.target.id === "report-form") { const task = state.fieldTasks.find((item) => item.id === event.target.dataset.id); const data = Object.fromEntries(new FormData(event.target)); Object.assign(task, data); const incident = state.incidents.find((item) => item.id === task.incidentId); incident.timeline.push({ title: "Field engineer report submitted", actor: currentUser().name, at: now() }); log(`Submitted report for ${task.id}`); save(); document.getElementById("modal")?.remove(); toast("Repair report submitted for verification"); render(); }
  if (event.target.id === "verify-form") { const task = state.fieldTasks.find((item) => item.id === event.target.dataset.id); task.status = "Completed"; const incident = state.incidents.find((item) => item.id === task.incidentId); incident.timeline.push({ title: "Field report verified", actor: currentUser().name, at: now() }); log(`Verified report ${task.id}`); save(); document.getElementById("modal")?.remove(); toast("Field work verified"); render(); }
  if (event.target.id === "task-update-form") { const task = state.fieldTasks.find((item) => item.id === event.target.dataset.id); Object.assign(task, Object.fromEntries(new FormData(event.target))); save(); document.getElementById("modal")?.remove(); toast("Field request updated"); render(); }
});

document.addEventListener("input", (event) => {
  if (["incident-scope", "incident-router", "incident-tower"].includes(event.target.id)) updateSlaPreview();
  if (["incident-search", "status-filter", "priority-filter", "category-filter"].includes(event.target.id)) {
    const query = document.getElementById("incident-search")?.value.toLowerCase() || "";
    const status = document.getElementById("status-filter")?.value || "";
    const priority = document.getElementById("priority-filter")?.value || "";
    const category = document.getElementById("category-filter")?.value || "";
    document.getElementById("incident-results").innerHTML = incidentTable(state.incidents.filter((incident) => `${incident.id} ${incident.title} ${incident.assignee}`.toLowerCase().includes(query) && (!status || incident.status === status) && (!priority || incident.priority === priority) && (!category || incident.category === category)));
  }
  if (["tower-search", "tower-status"].includes(event.target.id)) {
    const query = document.getElementById("tower-search")?.value.toLowerCase() || "", status = document.getElementById("tower-status")?.value || "";
    document.getElementById("tower-results").innerHTML = towerTable(state.towers.filter((tower) => `${tower.id} ${tower.name} ${tower.location}`.toLowerCase().includes(query) && (!status || tower.status === status)));
  }
  if (["router-search", "router-status"].includes(event.target.id)) {
    const query = document.getElementById("router-search")?.value.toLowerCase() || "", status = document.getElementById("router-status")?.value || "";
    document.getElementById("router-results").innerHTML = routerTable(state.routers.filter((router) => `${router.id} ${router.model}`.toLowerCase().includes(query) && (!status || router.status === status)));
  }
  if (["customer-search", "customer-status"].includes(event.target.id)) {
    const query = document.getElementById("customer-search")?.value.toLowerCase() || "", status = document.getElementById("customer-status")?.value || "";
    const customers = state.session === "customer" ? state.customers.filter((customer) => customer.name === currentUser().name) : state.customers;
    document.getElementById("customer-results").innerHTML = customerTable(customers.filter((customer) => `${customer.id} ${customer.name} ${customer.email}`.toLowerCase().includes(query) && (!status || customer.status === status)));
  }
});

function openModal(html) { document.body.insertAdjacentHTML("beforeend", html); updateSlaPreview(); }
render();
