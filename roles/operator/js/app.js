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
  ["sla-monitoring", "SLA Monitoring", "◷"],
  ["notifications", "Notifications", "◌"],
  ["reports", "Reports", "▥"],
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
      status, priority: policy.id, affected, assignee: ["Priya Nair", "Dev Patel", "Sana Khan"][index % 3], createdBy: "Customer",
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
      { id: "NT-1", title: "P1 SLA breach risk", detail: "INC-02402 needs immediate review.", read: false, at: now(), type: "SLA Alert", severity: "High", incidentId: "INC-02402" },
      { id: "NT-2", title: "Field report submitted", detail: "FS-109 is ready for validation.", read: false, at: now(), type: "Incident Update", severity: "Medium", incidentId: "INC-02408" }
    ],
    audit: []
  };
}

let state = loadState(createSeed);
let operatorDashboardPage = 0;
let operatorIncidentsPage = 0;
let operatorSlaMonitoringPage = 0;
let operatorIncidentDetailTab = "impact";
let operatorNotificationsPage = 0;
const selectedNotificationIds = new Set();
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
const localDateInput = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const incidentDateFilter = () => state.staffIncidentDateFilter || (state.staffIncidentDateFilter = { type: "all", date: localDateInput(new Date()) });
const matchesIncidentDate = (incident) => {
  const filter = incidentDateFilter();
  if (filter.type === "today") return localDateInput(incident.createdAt) === localDateInput(new Date());
  if (filter.type === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return localDateInput(incident.createdAt) === localDateInput(yesterday);
  }
  return filter.type !== "custom" || localDateInput(incident.createdAt) === filter.date;
};
const refreshIncidentResults = () => {
  const results = document.getElementById("incident-results");
  if (!results) return;
  const query = document.getElementById("incident-search")?.value.toLowerCase() || "";
  const status = document.getElementById("status-filter")?.value || "";
  const priority = document.getElementById("priority-filter")?.value || "";
  const category = document.getElementById("category-filter")?.value || "";
  results.innerHTML = incidentTable(visibleIncidents().filter((incident) =>
    matchesIncidentDate(incident) &&
    `${incident.id} ${incident.title} ${incident.assignee}`.toLowerCase().includes(query) &&
    (!status || incident.status === status) &&
    (!priority || incident.priority === priority) &&
    (!category || incident.category === category)
  ));
};
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
  return `<div class="app-shell role-${state.session}"><aside class="sidebar"><div class="brand"><div class="brand-mark">I</div><div><strong>ImpactFlow</strong><small>Network operations</small></div></div><nav><div class="nav-label">Workspace</div>${nav.slice(0, 6).map(([key, label, icon]) => navItem(key, label, icon)).join("")}<div class="nav-label">Management</div>${nav.slice(6).map(([key, label, icon]) => navItem(key, label, icon)).join("")}</nav><div class="sidebar-footer"><div class="role-chip">${currentUser().label}</div><button class="nav-item" data-action="logout"><span class="nav-icon">↪</span><span>Sign out</span></button></div></aside><main class="main"><header class="topbar"><span class="crumb">Workspace / <strong>${esc(state.page.split(":")[0])}</strong></span><div class="top-actions"><button class="icon-btn" data-page="notifications" aria-label="Notifications">◌${unread ? `<i class="dot"></i>` : ""}</button><div class="avatar">${currentUser().initials}</div></div></header><section class="content">${content}</section></main></div>`;
}

function pageHead(title, subtitle, action = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p class="subhead">${subtitle}</p></div>${action}</div>`;
}

function operatorDashboardSlaStatus(incident) {
  if (incident.status === "Resolved") return "On Time";
  const deadline = incident.status === "Open" ? incident.responseDeadline : incident.resolutionDeadline;
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return "Breached";
  if (remaining <= 2 * 60 * 60 * 1000) return "At Risk";
  return "On Time";
}

function operatorDashboardGroups(incidents, getLabel) {
  const groups = new Map();
  incidents.forEach((incident) => {
    const label = getLabel(incident);
    groups.set(label, (groups.get(label) || 0) + incident.affected);
  });
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

function operatorDashboardImpactChart(title, groups, chartType = "metric") {
  const shown = groups.slice(0, 6);
  const max = Math.max(1, ...shown.map(([, value]) => value));
  const chart = !shown.length ? `<div class="empty">No incident impact data available.</div>`
    : chartType === "column" ? `<div class="chart">${shown.map(([label, value]) => `<div class="bar-col"><i style="height:${Math.max(8, value / max * 100)}%"></i>${esc(label)}<br>${value.toLocaleString("en-IN")}</div>`).join("")}</div>`
      : `<div class="metric-list">${shown.map(([label, value]) => metric(esc(label), value.toLocaleString("en-IN"), value / max * 100)).join("")}</div>`;
  return `<div class="panel"><div class="panel-head"><h2>${title}</h2><button class="panel-link" data-page="incidents">View All</button></div>${chart}</div>`;
}

function operatorDashboardPieChart(title, groups) {
  const colors = ["#101b35", "#2f6fed", "#159570", "#c17a12", "#d84a4a", "#73809a"];
  const shown = groups.filter(([, value]) => value > 0).slice(0, colors.length);
  const total = shown.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return `<div class="panel"><div class="panel-head"><h2>${title}</h2><button class="panel-link" data-page="incidents">View All</button></div><div class="empty">No incident impact data available.</div></div>`;

  const circumference = 2 * Math.PI * 68;
  let offset = 0;
  const slices = shown.map(([, value], index) => {
    const length = value / total * circumference;
    const slice = `<circle cx="100" cy="100" r="68" fill="none" stroke="${colors[index]}" stroke-width="28" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 100 100)"></circle>`;
    offset += length;
    return slice;
  }).join("");
  const legend = shown.map(([label, value], index) => `<div style="display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:8px;font-size:12px"><i style="width:9px;height:9px;border-radius:50%;background:${colors[index]}"></i><span>${esc(label)}</span><strong>${value.toLocaleString("en-IN")}</strong></div>`).join("");
  return `<div class="panel"><div class="panel-head"><h2>${title}</h2><button class="panel-link" data-page="incidents">View All</button></div>
    <div style="display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap">
      <svg viewBox="0 0 200 200" role="img" aria-label="${esc(title)}: ${total.toLocaleString("en-IN")} affected customers" style="width:180px;max-width:100%;height:auto">
        <circle cx="100" cy="100" r="68" fill="none" stroke="#e7ebf3" stroke-width="28"></circle>${slices}
        <text x="100" y="96" text-anchor="middle" fill="#17233d" font-size="21" font-weight="700">${total.toLocaleString("en-IN")}</text>
        <text x="100" y="114" text-anchor="middle" fill="#73809a" font-size="9">Affected Customers</text>
      </svg>
      <div style="display:grid;gap:12px;min-width:145px">${legend}</div>
    </div>
  </div>`;
}

function operatorDashboardFilteredIncidents() {
  const query = document.getElementById("operator-dashboard-search")?.value.trim().toLowerCase() || "";
  const priority = document.getElementById("operator-dashboard-priority")?.value || "";
  const category = document.getElementById("operator-dashboard-category")?.value || "";
  const sla = document.getElementById("operator-dashboard-sla")?.value || "";
  const area = document.getElementById("operator-dashboard-area")?.value || "";
  const from = document.getElementById("operator-dashboard-date-from")?.value || "";
  const to = document.getElementById("operator-dashboard-date-to")?.value || "";
  return [...state.incidents]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((incident) => {
      const location = state.towers.find((tower) => tower.id === incident.towerId)?.location || "";
      const customerNames = state.customers.filter((customer) => customer.routerId === incident.routerId).map((customer) => customer.name).join(" ");
      const text = `${incident.id} ${incident.title} ${incident.description} ${incident.towerId} ${incident.routerId} ${customerNames}`.toLowerCase();
      const created = new Date(incident.createdAt).toISOString().slice(0, 10);
      return (!query || text.includes(query))
        && (!priority || incident.priority === priority)
        && (!category || incident.category === category)
        && (!sla || operatorDashboardSlaStatus(incident) === sla)
        && (!area || location === area)
        && (!from || created >= from)
        && (!to || created <= to);
    });
}

function operatorDashboardTable(incidents) {
  if (!incidents.length) return `<div class="empty">No incidents match these filters.</div>`;
  const areas = [...new Set(state.towers.map((tower) => tower.location))].sort();
  const start = operatorDashboardPage * 5;
  const shown = incidents.slice(start, start + 5);
  return `<div class="filters">
    <input class="search" id="operator-dashboard-search" aria-label="Search incidents, network assets and customers" placeholder="Search Ticket ID, Title, Tower, Router, Customer...">
    <select class="field" id="operator-dashboard-priority"><option value="">All Priorities</option>${["P1", "P2", "P3", "P4"].map((item) => `<option>${item}</option>`).join("")}</select>
    <select class="field" id="operator-dashboard-category"><option value="">All Categories</option>${["Connectivity", "Performance", "Hardware", "Planned maintenance"].map((item) => `<option>${item}</option>`).join("")}</select>
    <select class="field" id="operator-dashboard-sla"><option value="">All SLA Status</option>${["At Risk", "Breached", "On Time"].map((item) => `<option>${item}</option>`).join("")}</select>
    <select class="field" id="operator-dashboard-area"><option value="">All Areas</option>${areas.map((item) => `<option>${esc(item)}</option>`).join("")}</select>
    <label class="muted">Date Range <input class="field" type="date" id="operator-dashboard-date-from" aria-label="From date"></label>
    <label class="muted">To <input class="field" type="date" id="operator-dashboard-date-to" aria-label="To date"></label>
    <button class="btn btn-secondary" data-action="reset-dashboard-filters">Reset</button>
  </div>
  <div id="operator-dashboard-results">${operatorDashboardRows(shown)}</div>
  <div class="panel-head"><span class="muted" id="operator-dashboard-count">Showing ${start + 1} to ${start + shown.length} of ${incidents.length} incidents</span><div><button class="btn btn-secondary" data-action="operator-dashboard-page" data-direction="-1" ${operatorDashboardPage === 0 ? "disabled" : ""}>‹</button> <button class="btn btn-secondary" data-action="operator-dashboard-page" data-direction="1" ${start + 5 >= incidents.length ? "disabled" : ""}>›</button> <button class="panel-link" data-page="incidents">View all incidents →</button></div></div>`;
}

function operatorDashboardRows(incidents) {
  if (!incidents.length) return `<div class="empty">No incidents match these filters.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Ticket ID</th><th>Title</th><th>Area</th><th>Tower</th><th>Router</th><th>Priority</th><th>SLA Status</th><th>Created Date</th><th>Actions</th></tr></thead><tbody>${incidents.map((incident) => {
    const tower = state.towers.find((item) => item.id === incident.towerId);
    const router = state.routers.find((item) => item.id === incident.routerId);
    const slaStatus = operatorDashboardSlaStatus(incident);
    return `<tr class="clickable" data-incident="${incident.id}"><td class="primary-text">${esc(incident.id)}</td><td>${esc(incident.title)}</td><td>${esc(tower?.location || "—")}</td><td>${esc(tower?.id || "—")}</td><td>${esc(router?.id || "—")}</td><td>${badge(incident.priority)}</td><td>${badge(slaStatus)}</td><td>${date(incident.createdAt)}</td><td><button class="table-action" data-incident="${incident.id}">View</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function updateOperatorDashboardTable() {
  const results = document.getElementById("operator-dashboard-results");
  if (!results) return;
  const incidents = operatorDashboardFilteredIncidents();
  const pageCount = Math.max(1, Math.ceil(incidents.length / 5));
  operatorDashboardPage = Math.min(operatorDashboardPage, pageCount - 1);
  const start = operatorDashboardPage * 5;
  const shown = incidents.slice(start, start + 5);
  results.innerHTML = operatorDashboardRows(shown);
  const count = document.getElementById("operator-dashboard-count");
  if (count) count.textContent = `Showing ${incidents.length ? start + 1 : 0} to ${start + shown.length} of ${incidents.length} incidents`;
  const pager = results.parentElement.querySelectorAll('[data-action="operator-dashboard-page"]');
  if (pager.length) {
    pager[0].disabled = operatorDashboardPage === 0;
    pager[1].disabled = start + 5 >= incidents.length;
  }
}

function operatorDashboard() {
  const all = state.incidents;
  const active = all.filter((incident) => incident.status !== "Resolved");
  const atRisk = active.filter((incident) => operatorDashboardSlaStatus(incident) === "At Risk").length;
  const breached = active.filter((incident) => operatorDashboardSlaStatus(incident) === "Breached").length;
  const card = (icon, label, value, page = "incidents") => `<div class="stat-card"><span class="stat-label">${icon} &nbsp; ${label}</span><strong class="stat-value">${value}</strong><button class="panel-link" data-page="${page}">View Details →</button></div>`;
  const byArea = operatorDashboardGroups(active, (incident) => state.towers.find((tower) => tower.id === incident.towerId)?.location || "Unknown");
  const byTower = operatorDashboardGroups(active, (incident) => state.towers.find((tower) => tower.id === incident.towerId)?.id || "Unknown");
  const byRouter = operatorDashboardGroups(active, (incident) => incident.routerId || "Unknown");
  const topFive = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `${pageHead("Network Operator", `Welcome back, ${esc(currentUser().name.split(" ")[0])}. Monitor incidents, track SLA and ensure timely resolution.`)}
    <div class="stats">
      ${card("▤", "Open Incidents", active.length)}
      ${card("⚠", "P2 · High", active.filter((incident) => incident.priority === "P2").length)}
      ${card("▥", "P3 · Medium", active.filter((incident) => incident.priority === "P3").length)}
      ${card("◷", "SLA At Risk", atRisk, "incidents")}
      ${card("ⓘ", "SLA Breached", breached, "incidents")}
    </div>
    <div class="grid-2">
      ${operatorDashboardImpactChart("Customers Affected by Area", byArea)}
      ${operatorDashboardPieChart("Customers Affected by Tower", byTower)}
    </div>
    ${operatorDashboardImpactChart("Customers Affected by Routers", byRouter, "column")}
    <div class="panel"><div class="panel-head"><h2>Last 5 Incidents Raised</h2><button class="panel-link" data-page="incidents">View All →</button></div>
      ${operatorDashboardTable(topFive)}
    </div>`;
}

function dashboard() {
  if (state.session === "operator") return operatorDashboard();
  const config = roleDashboards[state.session];
  const visible = visibleIncidents();
  const action = config.primaryAction === "create" ? "create" : config.primaryAction;
  const hasIncidentWorkspace = rolePages().includes("incidents");
  const dashboardAction = state.session === "admin" ? "infrastructure" : action;
  const dashboardActionLabel = state.session === "admin" ? "View infrastructure" : state.session === "engineer" ? "View field work" : state.session === "lead" ? "Review escalations" : state.session === "customer" ? "Raise incident" : "Open incident queue";
  const stats = config.stats.map(([label, value, trend]) => stat(label, value(state), trend)).join("");
  const panelTitle = state.session === "lead" ? "Escalation workload" : state.session === "engineer" ? "Assigned field work" : state.session === "customer" ? "My recent tickets" : "Recent incidents";
  const panelItems = state.session === "lead" ? state.incidents.filter((item) => item.escalated) : state.session === "engineer" ? state.fieldTasks : visible;
  return `${pageHead(config.title, `Good morning, ${currentUser().name.split(" ")[0]}. ${config.subtitle}`, `<button class="btn btn-primary" data-page="${dashboardAction}">＋ ${dashboardActionLabel}</button>`)}<div class="stats">${stats}</div><div class="panel"><div class="panel-head"><h2>${panelTitle}</h2>${hasIncidentWorkspace ? `<button class="panel-link" data-page="${action === "create" ? "incidents" : action}">View all →</button>` : ""}</div>${state.session === "engineer" ? fieldTaskTable(panelItems) : incidentTable(panelItems.slice(0, 7))}</div>`;
}

function incidentTable(items) {
  if (!items.length) return `<div class="empty">No incidents match this view.</div>`;
  const canOpenIncident = rolePages().includes("incidents");
  return `<div class="table-wrap"><table><thead><tr><th>Incident</th><th>Priority</th><th>Status</th><th>Impact</th><th>Assignee</th><th>Updated</th></tr></thead><tbody>${items.map((incident) => `<tr ${canOpenIncident ? `data-incident="${incident.id}" class="clickable"` : ""}><td><span class="primary-text">${incident.id}</span><br><span class="muted">${esc(incident.title)}</span></td><td>${badge(incident.priority)}</td><td>${badge(incident.status)}</td><td>${incident.affected} customers</td><td>${esc(incident.assignee)}</td><td>${date(incident.timeline?.at(-1)?.at || incident.updatedAt || incident.createdAt)}</td></tr>`).join("")}</tbody></table></div>`;
}

function operatorIncidentsKpiValues() {
  const active = state.incidents.filter((incident) => incident.status !== "Resolved");
  return [
    active.length,
    active.filter((incident) => incident.priority === "P2").length,
    active.filter((incident) => incident.priority === "P3").length,
    active.filter((incident) => incident.priority === "P4").length
  ];
}

function operatorIncidentsFiltered() {
  const query = document.getElementById("operator-incidents-search")?.value.trim().toLowerCase() || "";
  const priority = document.getElementById("operator-incidents-priority")?.value || "";
  const category = document.getElementById("operator-incidents-category")?.value || "";
  const area = document.getElementById("operator-incidents-area")?.value || "";
  const status = document.getElementById("operator-incidents-status")?.value || "";
  const sla = document.getElementById("operator-incidents-sla")?.value || "";
  const from = document.getElementById("operator-incidents-date-from")?.value || "";
  const to = document.getElementById("operator-incidents-date-to")?.value || "";

  return [...state.incidents]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((incident) => {
      const location = state.towers.find((tower) => tower.id === incident.towerId)?.location || "";
      const text = `${incident.id} ${incident.title} ${incident.description}`.toLowerCase();
      const created = new Date(incident.createdAt).toISOString().slice(0, 10);
      return (!query || text.includes(query))
        && (!priority || incident.priority === priority)
        && (!category || incident.category === category)
        && (!area || location === area)
        && (!status || incident.status === status)
        && (!sla || operatorDashboardSlaStatus(incident) === sla)
        && (!from || created >= from)
        && (!to || created <= to);
    });
}

function operatorIncidentsTable(incidents) {
  if (!incidents.length) return `<div class="empty">No incidents match these filters.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Ticket ID</th><th>Title</th><th>Status</th><th>Tower</th><th>Router</th><th>Impacted Customers</th><th>Priority</th><th>SLA Status</th><th>Created Date</th><th>Actions</th></tr></thead><tbody>${incidents.map((incident) => {
    const tower = state.towers.find((item) => item.id === incident.towerId);
    const router = state.routers.find((item) => item.id === incident.routerId);
    return `<tr class="clickable" data-incident="${esc(incident.id)}"><td class="primary-text">${esc(incident.id)}</td><td>${esc(incident.title)}</td><td>${badge(incident.status)}</td><td>${esc(tower?.id || "—")}</td><td>${esc(router?.id || "—")}</td><td>${Number(incident.affected || 0).toLocaleString("en-IN")}</td><td>${badge(incident.priority)}</td><td>${badge(operatorDashboardSlaStatus(incident))}</td><td>${date(incident.createdAt)}</td><td><button class="table-action" data-incident="${esc(incident.id)}">View</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function operatorIncidentsResults(incidents) {
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(incidents.length / pageSize));
  operatorIncidentsPage = Math.min(operatorIncidentsPage, pageCount - 1);
  const start = operatorIncidentsPage * pageSize;
  const shown = incidents.slice(start, start + pageSize);
  const firstPage = Math.max(0, Math.min(operatorIncidentsPage - 2, pageCount - 5));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);
  const rangeStart = incidents.length ? start + 1 : 0;
  const rangeEnd = start + shown.length;

  return `${operatorIncidentsTable(shown)}
    <div class="panel-head"><span class="muted" id="operator-incidents-count">Showing ${rangeStart} to ${rangeEnd} of ${incidents.length} incidents</span><div>
      <button class="btn btn-secondary" data-action="operator-incidents-page" data-page-number="${Math.max(0, operatorIncidentsPage - 1)}" aria-label="Previous page" ${operatorIncidentsPage === 0 ? "disabled" : ""}>‹</button>
      ${incidents.length ? pages.map((page) => `<button class="btn ${page === operatorIncidentsPage ? "btn-primary" : "btn-secondary"}" data-action="operator-incidents-page" data-page-number="${page}" aria-label="Page ${page + 1}" ${page === operatorIncidentsPage ? 'aria-current="page"' : ""}>${page + 1}</button>`).join(" ") : ""}
      <button class="btn btn-secondary" data-action="operator-incidents-page" data-page-number="${Math.min(pageCount - 1, operatorIncidentsPage + 1)}" aria-label="Next page" ${operatorIncidentsPage >= pageCount - 1 ? "disabled" : ""}>›</button>
    </div></div>`;
}

function updateOperatorIncidents() {
  const results = document.getElementById("operator-incidents-results");
  if (!results) return;
  results.innerHTML = operatorIncidentsResults(operatorIncidentsFiltered());
}

function updateOperatorIncidentsKpis() {
  const values = operatorIncidentsKpiValues();
  document.querySelectorAll("#operator-incidents-stats .stat-value").forEach((element, index) => {
    element.textContent = values[index];
  });
}

function operatorIncidentsView() {
  const values = operatorIncidentsKpiValues();
  const kpis = `<div class="stats" id="operator-incidents-stats">${stat("Open Incidents", values[0], "Active network incidents")}${stat("P2 · High", values[1], "High priority")}${stat("P3 · Medium", values[2], "Medium priority")}${stat("P4 · Low", values[3], "Low priority")}</div>`;
  const areas = [...new Set(state.towers.map((tower) => tower.location))].sort();
  const categories = [...new Set(["Connectivity", "Performance", "Hardware", "Planned maintenance", ...state.incidents.map((incident) => incident.category)])].sort();
  const statuses = [...new Set(["Open", "Investigating", "Escalated", "Pending validation", "Resolved", ...state.incidents.map((incident) => incident.status)])].sort();
  const filters = `<div class="filters" id="operator-incident-filters">
    <div class="form-group"><label for="operator-incidents-search">Search</label><input class="search" id="operator-incidents-search" aria-label="Search by ticket ID, title or description" placeholder="Search by Ticket ID, Title or Description"></div>
    <div class="form-group"><label for="operator-incidents-priority">Priority</label><select class="field" id="operator-incidents-priority"><option value="">All Priorities</option>${["P1", "P2", "P3", "P4"].map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-incidents-category">Incident Category</label><select class="field" id="operator-incidents-category"><option value="">All Categories</option>${categories.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-incidents-area">Area</label><select class="field" id="operator-incidents-area"><option value="">All Areas</option>${areas.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-incidents-status">Incident Status</label><select class="field" id="operator-incidents-status"><option value="">All Incidents</option>${statuses.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-incidents-sla">SLA Status</label><select class="field" id="operator-incidents-sla"><option value="">All SLA Statuses</option>${["Breached", "At Risk", "On Time"].map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="form-group"><label>Date Range</label><div><input class="field" type="date" id="operator-incidents-date-from" aria-label="From date"> <input class="field" type="date" id="operator-incidents-date-to" aria-label="To date"></div></div>
    <button class="btn btn-secondary" data-action="reset-operator-incident-filters">Reset</button>
  </div>`;
  return `${pageHead("Open Incidents", "View and manage all open incidents. Assess impact, monitor SLA and take necessary actions.", `<button class="btn btn-secondary" data-action="refresh-operator-incidents">⟳ Refresh</button>`)}
    ${kpis}<div class="panel">${filters}<div id="operator-incidents-results">${operatorIncidentsResults(operatorIncidentsFiltered())}</div></div>`;
}

function incidentsView() {
  if (state.session === "operator") return operatorIncidentsView();
  const dateFilter = incidentDateFilter();
  const controls = `<div class="filters"><input class="search" id="incident-search" placeholder="Search ID, title or assignee"><select class="field" id="status-filter"><option value="">All statuses</option>${["Open", "Investigating", "Escalated", "Pending validation", "Resolved"].map((item) => `<option>${item}</option>`).join("")}</select><select class="field" id="priority-filter"><option value="">All priorities</option>${["P1", "P2", "P3", "P4"].map((item) => `<option>${item}</option>`).join("")}</select><select class="field" id="category-filter"><option value="">All categories</option><option>Connectivity</option><option>Performance</option><option>Hardware</option></select><select class="field" id="incident-date-filter" aria-label="Filter by date"><option value="all" ${dateFilter.type === "all" ? "selected" : ""}>All dates</option><option value="today" ${dateFilter.type === "today" ? "selected" : ""}>Today</option><option value="yesterday" ${dateFilter.type === "yesterday" ? "selected" : ""}>Yesterday</option><option value="custom" ${dateFilter.type === "custom" ? "selected" : ""}>Select from calendar</option></select><input id="incident-date-picker" type="date" class="field ${dateFilter.type === "custom" ? "" : "hidden"}" value="${dateFilter.date}" aria-label="Select incident date"></div>`;
  const action = state.session === "customer" ? `<button class="btn btn-primary" data-page="create">＋ Raise incident</button>` : "";
  const incidents = visibleIncidents().filter(matchesIncidentDate);
  return `${pageHead(state.session === "customer" ? "My incidents" : "Incident management", state.session === "customer" ? "Track your own network support tickets and resolutions." : "Search, filter and action the network incident queue.", action)}<div class="panel">${controls}<div id="incident-results">${incidentTable(incidents)}</div></div>`;
}

function operatorSlaStatus(incident) {
  const status = operatorDashboardSlaStatus(incident);
  return status === "On Time" ? "On Track" : status;
}

function operatorSlaTimeRemaining(incident) {
  if (incident.status === "Resolved") return "—";
  const deadline = incident.status === "Open" ? incident.responseDeadline : incident.resolutionDeadline;
  const difference = new Date(deadline).getTime() - Date.now();
  const totalSeconds = Math.floor(Math.abs(difference) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${difference < 0 ? "-" : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function operatorSlaTarget(hours) {
  return hours < 1 ? `${Math.round(hours * 60)} Min` : `${hours} Hours`;
}

function operatorSlaFilteredIncidents() {
  const query = document.getElementById("operator-sla-filter-search")?.value.trim().toLowerCase() || "";
  const priority = document.getElementById("operator-sla-filter-priority")?.value || "";
  const category = document.getElementById("operator-sla-filter-category")?.value || "";
  const area = document.getElementById("operator-sla-filter-area")?.value || "";
  const status = document.getElementById("operator-sla-filter-status")?.value || "";
  const sla = document.getElementById("operator-sla-filter-sla")?.value || "";
  const from = document.getElementById("operator-sla-filter-date-from")?.value || "";
  const to = document.getElementById("operator-sla-filter-date-to")?.value || "";

  return [...state.incidents]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((incident) => {
      const location = state.towers.find((tower) => tower.id === incident.towerId)?.location || "";
      const text = `${incident.id} ${incident.title} ${incident.description}`.toLowerCase();
      const created = new Date(incident.createdAt).toISOString().slice(0, 10);
      return (!query || text.includes(query))
        && (!priority || incident.priority === priority)
        && (!category || incident.category === category)
        && (!area || location === area)
        && (!status || incident.status === status)
        && (!sla || operatorSlaStatus(incident) === sla)
        && (!from || created >= from)
        && (!to || created <= to);
    });
}

function operatorSlaTable(incidents) {
  if (!incidents.length) return `<div class="empty">No incidents match these filters.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Ticket ID</th><th>Title</th><th>Priority</th><th>Response SLA</th><th>Resolution SLA</th><th>Time Remaining</th><th>SLA Status</th><th>Created Date</th><th>Actions</th></tr></thead><tbody>${incidents.map((incident) => {
    const policy = state.policies.find((item) => item.id === incident.priority) || policyFor(incident.affected);
    return `<tr class="clickable" data-incident="${esc(incident.id)}"><td class="primary-text">${esc(incident.id)}</td><td>${esc(incident.title)}</td><td>${badge(incident.priority)}</td><td>${operatorSlaTarget(policy.response)}</td><td>${operatorSlaTarget(policy.resolution)}</td><td>${operatorSlaTimeRemaining(incident)}</td><td>${badge(operatorSlaStatus(incident))}</td><td>${date(incident.createdAt)}</td><td><button class="table-action" data-incident="${esc(incident.id)}">View</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function operatorSlaResults(incidents) {
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(incidents.length / pageSize));
  operatorSlaMonitoringPage = Math.min(operatorSlaMonitoringPage, pageCount - 1);
  const start = operatorSlaMonitoringPage * pageSize;
  const shown = incidents.slice(start, start + pageSize);
  const firstPage = Math.max(0, Math.min(operatorSlaMonitoringPage - 2, pageCount - 5));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);
  const rangeStart = incidents.length ? start + 1 : 0;
  const rangeEnd = start + shown.length;
  return `${operatorSlaTable(shown)}
    <div class="panel-head"><span class="muted" id="operator-sla-count">Showing ${rangeStart} to ${rangeEnd} of ${incidents.length} incidents</span><div>
      <button class="btn btn-secondary" data-action="operator-sla-page" data-page-number="${Math.max(0, operatorSlaMonitoringPage - 1)}" aria-label="Previous page" ${operatorSlaMonitoringPage === 0 ? "disabled" : ""}>‹</button>
      ${incidents.length ? pages.map((page) => `<button class="btn ${page === operatorSlaMonitoringPage ? "btn-primary" : "btn-secondary"}" data-action="operator-sla-page" data-page-number="${page}" aria-label="Page ${page + 1}" ${page === operatorSlaMonitoringPage ? 'aria-current="page"' : ""}>${page + 1}</button>`).join(" ") : ""}
      <button class="btn btn-secondary" data-action="operator-sla-page" data-page-number="${Math.min(pageCount - 1, operatorSlaMonitoringPage + 1)}" aria-label="Next page" ${operatorSlaMonitoringPage >= pageCount - 1 ? "disabled" : ""}>›</button>
    </div></div>`;
}

function updateOperatorSlaMonitoring() {
  const results = document.getElementById("operator-sla-results");
  if (!results) return;
  results.innerHTML = operatorSlaResults(operatorSlaFilteredIncidents());
}

function operatorSlaMonitoringView() {
  const statuses = state.incidents.map(operatorSlaStatus);
  const values = [
    statuses.filter((status) => status === "Breached").length,
    statuses.filter((status) => status === "At Risk").length,
    statuses.filter((status) => status === "On Track").length,
    state.incidents.length
  ];
  const stats = `<div class="stats" id="operator-sla-stats">${stat("Incidents Breached", values[0], "SLA deadline passed")}${stat("At Risk", values[1], "Approaching deadline")}${stat("On Track", values[2], "Within SLA")}${stat("Total Incidents", values[3], "All incidents")}</div>`;
  const categories = [...new Set(["Connectivity", "Performance", "Hardware", "Planned maintenance", ...state.incidents.map((incident) => incident.category)])].sort();
  const areas = [...new Set(state.towers.map((tower) => tower.location))].sort();
  const incidentStatuses = [...new Set(state.incidents.map((incident) => incident.status))].sort();
  const filters = `<div class="filters" id="operator-sla-filters">
    <div class="form-group"><label for="operator-sla-filter-search">Search</label><input class="search" id="operator-sla-filter-search" aria-label="Search by ticket ID, title or description" placeholder="Search by Ticket ID, Title or Description"></div>
    <div class="form-group"><label for="operator-sla-filter-priority">Priority</label><select class="field" id="operator-sla-filter-priority"><option value="">All Priorities</option>${["P1", "P2", "P3", "P4"].map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-sla-filter-category">Incident Category</label><select class="field" id="operator-sla-filter-category"><option value="">All Categories</option>${categories.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-sla-filter-area">Area</label><select class="field" id="operator-sla-filter-area"><option value="">All Areas</option>${areas.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-sla-filter-status">Incident Status</label><select class="field" id="operator-sla-filter-status"><option value="">All Incidents</option>${incidentStatuses.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-sla-filter-sla">SLA Status</label><select class="field" id="operator-sla-filter-sla"><option value="">All SLA Statuses</option>${["Breached", "At Risk", "On Track"].map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="form-group"><label>Date Range</label><div><input class="field" type="date" id="operator-sla-filter-date-from" aria-label="From date"> <input class="field" type="date" id="operator-sla-filter-date-to" aria-label="To date"></div></div>
    <button class="btn btn-secondary" data-action="reset-operator-sla-filters">Reset</button>
  </div>`;
  return `${pageHead("SLA Monitoring", "Monitor incident SLAs, track response and resolution times, and identify potential breaches.")}
    ${stats}<div class="panel">${filters}</div>
    <div class="panel"><div class="panel-head"><h2>SLA Compliance</h2></div><div id="operator-sla-results">${operatorSlaResults(operatorSlaFilteredIncidents())}</div></div>`;
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

function operatorReportResolutionTime(incident) {
  const resolvedEvent = [...(incident.timeline || [])].reverse().find((item) => /incident resolved and closed/i.test(item.title));
  if (!resolvedEvent) return null;
  const duration = new Date(resolvedEvent.at).getTime() - new Date(incident.createdAt).getTime();
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function operatorReportDuration(milliseconds) {
  const minutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${String(remainingMinutes).padStart(2, "0")}m` : `${remainingMinutes}m`;
}

function operatorReportMonths(incidents) {
  const currentMonth = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 5 + index, 1));
  return months.map((month) => ({
    label: month.toLocaleString("en-IN", { month: "short" }),
    count: incidents.filter((incident) => {
      const created = new Date(incident.createdAt);
      return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth();
    }).length
  }));
}

function operatorReportLineChart(title, description, values) {
  const max = Math.max(1, ...values.map((item) => item.count));
  const points = values.map((item, index) => ({
    ...item,
    x: 34 + index * 51,
    y: 104 - item.count / max * 76
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labels = points.map((point) => `<text x="${point.x}" y="132" text-anchor="middle" fill="#73809a" font-size="10">${esc(point.label)}</text><circle cx="${point.x}" cy="${point.y}" r="3.5" fill="#0e9f77"></circle><text x="${point.x}" y="${point.y - 8}" text-anchor="middle" fill="#17233d" font-size="10" font-weight="700">${point.count}</text>`).join("");
  return `<div class="panel report-panel"><div class="panel-head"><h2>${title}</h2></div><p class="report-caption">${description}</p><svg class="report-chart" viewBox="0 0 300 145" role="img" aria-label="${esc(title)}: ${values.map((item) => `${item.label} ${item.count}`).join(", ")}">
    <line x1="30" y1="28" x2="290" y2="28" stroke="#e7ebf3"></line><line x1="30" y1="66" x2="290" y2="66" stroke="#e7ebf3"></line><line x1="30" y1="104" x2="290" y2="104" stroke="#e7ebf3"></line>
    <polyline points="${line}" fill="none" stroke="#0e9f77" stroke-width="2"></polyline>${labels}
  </svg></div>`;
}

function operatorReportPriorityChart(incidents) {
  const colors = ["#d84a4a", "#c17a12", "#2f6fed", "#159570"];
  const priorities = ["P1", "P2", "P3", "P4"].map((priority) => ({
    label: priority,
    count: incidents.filter((incident) => incident.priority === priority).length
  }));
  const total = priorities.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const circumference = 2 * Math.PI * 45;
  const segments = priorities.filter((item) => item.count).map((item) => {
    const length = item.count / total * circumference;
    const color = colors[priorities.indexOf(item)];
    const segment = `<circle cx="60" cy="60" r="45" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)"></circle>`;
    offset += length;
    return segment;
  }).join("");
  return `<div class="panel report-panel"><div class="panel-head"><h2>Priority Distribution</h2></div>${total ? `<div class="report-donut-wrap"><svg class="report-donut" viewBox="0 0 120 120" role="img" aria-label="Priority distribution: ${priorities.map((item) => `${item.label} ${item.count}`).join(", ")}"><circle cx="60" cy="60" r="45" fill="none" stroke="#e7ebf3" stroke-width="18"></circle>${segments}<text x="60" y="58" text-anchor="middle" fill="#17233d" font-size="18" font-weight="700">${total}</text><text x="60" y="72" text-anchor="middle" fill="#73809a" font-size="8">Incidents</text></svg><div class="report-legend">${priorities.map((item, index) => `<div><i style="background:${colors[index]}"></i><span>${item.label}</span><strong>${item.count}</strong></div>`).join("")}</div></div>` : `<div class="empty">No incidents to analyze.</div>`}</div>`;
}

function operatorReportResolutionChart(incidents) {
  const priorities = ["P2", "P3", "P4"].map((priority) => {
    const durations = incidents.filter((incident) => incident.priority === priority)
      .map(operatorReportResolutionTime).filter((duration) => duration !== null);
    return { priority, average: durations.length ? durations.reduce((sum, item) => sum + item, 0) / durations.length : null };
  }).filter((item) => item.average !== null);
  if (!priorities.length) return `<div class="panel report-panel"><div class="panel-head"><h2>Resolution Time Comparison</h2></div><div class="empty">No recorded resolution times yet.</div></div>`;
  const max = Math.max(...priorities.map((item) => item.average));
  return `<div class="panel report-panel"><div class="panel-head"><h2>Resolution Time Comparison</h2></div><p class="report-caption">Average recorded resolution time by priority</p><div class="chart report-bars">${priorities.map((item) => `<div class="bar-col"><span>${operatorReportDuration(item.average)}</span><i style="height:${Math.max(8, item.average / max * 78)}%"></i>${item.priority}</div>`).join("")}</div></div>`;
}

function operatorReportResourceChart(incidents) {
  const routerIds = new Set(incidents.map((incident) => incident.routerId).filter(Boolean));
  const towerIds = new Set(incidents.map((incident) => incident.towerId).filter(Boolean));
  const towerRouterIds = new Set(state.routers.filter((router) => towerIds.has(router.towerId)).map((router) => router.id));
  const resources = [
    { label: "Routers", ids: routerIds, color: "#0e9f77" },
    { label: "Towers", ids: towerIds, color: "#2f6fed" }
  ].map((item) => {
    const customerCount = state.customers.filter((customer) => item.label === "Routers"
      ? item.ids.has(customer.routerId)
      : towerRouterIds.has(customer.routerId)).length;
    return { ...item, count: item.ids.size, customers: customerCount };
  });
  const maxResources = Math.max(1, ...resources.map((item) => item.count));
  const maxCustomers = Math.max(1, ...resources.map((item) => item.customers));
  const point = (item) => ({
    x: 45 + item.count / maxResources * 205,
    y: 105 - item.customers / maxCustomers * 78
  });
  return `<div class="panel report-panel"><div class="panel-head"><h2>Network Resource Impact</h2></div><p class="report-caption">Unique resources and mapped customers linked to incidents</p><svg class="report-chart" viewBox="0 0 300 145" role="img" aria-label="Network resource impact: ${resources.map((item) => `${item.label} ${item.count} resources, ${item.customers} customers`).join("; ")}">
    <line x1="35" y1="105" x2="275" y2="105" stroke="#aeb8ca"></line><line x1="35" y1="20" x2="35" y2="105" stroke="#aeb8ca"></line><text x="155" y="138" text-anchor="middle" fill="#73809a" font-size="10">Impacted resources</text><text x="10" y="63" transform="rotate(-90 10 63)" text-anchor="middle" fill="#73809a" font-size="9">Customers</text>
    ${resources.map((item) => { const position = point(item); const textX = position.x > 190 ? position.x - 10 : position.x + 10; const anchor = position.x > 190 ? "end" : "start"; return `<circle cx="${position.x}" cy="${position.y}" r="7" fill="${item.color}"></circle><text x="${textX}" y="${position.y - 5}" text-anchor="${anchor}" fill="#17233d" font-size="10">${item.label}: ${item.count}, ${item.customers.toLocaleString("en-IN")}</text>`; }).join("")}
  </svg></div>`;
}

function operatorReportEscalationChart(incidents) {
  const escalated = incidents.filter((incident) => incident.escalated);
  return operatorReportLineChart("Escalation Analysis", "Escalated incidents by incident creation month", operatorReportMonths(escalated));
}

function operatorReportCategoryChart(incidents) {
  const categories = [...new Set(incidents.map((incident) => incident.category))].map((category) => ({
    category,
    count: incidents.filter((incident) => incident.category === category).length
  })).sort((a, b) => b.count - a.count);
  if (!categories.length) return `<div class="panel report-panel"><div class="panel-head"><h2>Incident Category Breakdown</h2></div><div class="empty">No incidents to analyze.</div></div>`;
  const max = Math.max(...categories.map((item) => item.count));
  return `<div class="panel report-panel"><div class="panel-head"><h2>Incident Category Breakdown</h2></div><div class="metric-list">${categories.map((item) => metric(esc(item.category), item.count, item.count / max * 100)).join("")}</div></div>`;
}

function operatorReportInsights(incidents, escalationCount, customerCount) {
  const categoryCounts = new Map();
  const areaCustomers = new Map();
  const areaSla = new Map();
  incidents.forEach((incident) => {
    categoryCounts.set(incident.title, (categoryCounts.get(incident.title) || 0) + 1);
    const tower = state.towers.find((item) => item.id === incident.towerId);
    const location = tower?.location || "Unknown";
    if (!areaCustomers.has(location)) areaCustomers.set(location, new Set());
    state.customers.filter((customer) => customer.routerId === incident.routerId).forEach((customer) => areaCustomers.get(location).add(customer.id));
    if (!areaSla.has(location)) areaSla.set(location, { compliant: 0, total: 0 });
    const sla = areaSla.get(location);
    sla.total += 1;
    if (operatorSlaStatus(incident) === "On Track") sla.compliant += 1;
  });
  const mostFrequent = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const highestImpact = [...areaCustomers.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  const bestCompliance = [...areaSla.entries()].sort((a, b) => b[1].compliant / b[1].total - a[1].compliant / a[1].total)[0];
  const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const dailyAverage = incidents.filter((incident) => new Date(incident.createdAt).getTime() >= last30Days).length / 30;
  const insights = [
    ["Most Frequent Incident Type", mostFrequent],
    ["Highest Impact Area", highestImpact ? `${highestImpact[0]} · ${highestImpact[1].size} customers` : "—"],
    ["Best SLA Compliance Area", bestCompliance ? `${bestCompliance[0]} · ${Math.round(bestCompliance[1].compliant / bestCompliance[1].total * 100)}%` : "—"],
    ["Total Customers Impacted", customerCount.toLocaleString("en-IN")],
    ["Average Daily Incidents", dailyAverage.toFixed(1)],
    ["Total Escalations", escalationCount.toLocaleString("en-IN")]
  ];
  return `<div class="panel report-panel"><div class="panel-head"><h2>Operational Insights</h2></div><div class="report-insights">${insights.map(([label, value]) => `<div><span class="muted">${label}</span><strong>${esc(value)}</strong></div>`).join("")}</div></div>`;
}

function operatorReportsView() {
  const incidents = state.incidents;
  const statuses = incidents.map(operatorSlaStatus);
  const slaCompliance = incidents.length ? Math.round(statuses.filter((status) => status === "On Track").length / incidents.length * 1000) / 10 : 0;
  const resolutionTimes = incidents.map(operatorReportResolutionTime).filter((duration) => duration !== null);
  const averageResolution = resolutionTimes.length
    ? operatorReportDuration(resolutionTimes.reduce((sum, duration) => sum + duration, 0) / resolutionTimes.length)
    : "—";
  const escalationCount = incidents.reduce((sum, incident) => {
    const events = (incident.timeline || []).filter((item) => /escalat/i.test(item.title)).length;
    return sum + (events || (incident.escalated ? 1 : 0));
  }, 0);
  const impactedRouters = new Set(incidents.map((incident) => incident.routerId).filter(Boolean));
  const impactedCustomers = state.customers.filter((customer) => impactedRouters.has(customer.routerId)).length;
  const stats = `<div class="stats">${stat("Total Incidents Analyzed", incidents.length, "All recorded incidents")}${stat("SLA Compliance", `${slaCompliance}%`, "On track against allocated SLA")}${stat("Average Resolution Time", averageResolution, resolutionTimes.length ? `${resolutionTimes.length} recorded resolutions` : "No recorded resolution times")}${stat("Total Escalations", escalationCount, "Escalated incidents and events")}</div>`;
  const insights = operatorReportInsights(incidents, escalationCount, impactedCustomers);
  return `${pageHead("Reports & Analytics", "Operational insights, incident trends, SLA compliance, and network performance reporting.")}
    ${stats}<div class="reports-grid">
      ${operatorReportPriorityChart(incidents)}
      ${operatorReportLineChart("Monthly Incident Trend", "Incidents created over the last six months", operatorReportMonths(incidents))}
      ${operatorReportResolutionChart(incidents)}
      ${operatorReportResourceChart(incidents)}
      ${operatorReportEscalationChart(incidents)}
      ${operatorReportCategoryChart(incidents)}
    </div>${insights}`;
}

function reportsView() {
  if (state.session === "operator") return operatorReportsView();
  const resolved = state.incidents.filter((incident) => incident.status === "Resolved").length;
  return `${pageHead("Reports & analytics", "Measure service quality, SLA performance and operational load.", `<button class="btn btn-secondary" data-action="export">⇩ Export CSV</button>`)}<div class="stats">${stat("SLA compliance", "96.8%", "↑ 2.4% this period")}${stat("MTTR", "3h 42m", "↓ 18m vs last month")}${stat("First response", "18m", "↓ 6m vs last month")}${stat("Resolved incidents", resolved, "Current dataset")}</div><div class="grid-2"><div class="panel"><div class="panel-head"><h2>Resolution trend</h2><span class="muted">Last 7 periods</span></div><div class="chart">${[78, 70, 65, 60, 53, 49, 42].map((height, index) => `<div class="bar-col"><i style="height:${height}%"></i>W${index + 1}</div>`).join("")}</div></div><div class="panel"><div class="panel-head"><h2>Incident categories</h2></div><div class="metric-list">${metric("Connectivity", state.incidents.filter((i) => i.category === "Connectivity").length, 86)}${metric("Performance", state.incidents.filter((i) => i.category === "Performance").length, 58, "amber")}${metric("Hardware", state.incidents.filter((i) => i.category === "Hardware").length, 33, "green")}</div></div></div><div class="panel"><div class="panel-head"><h2>Operational summary</h2></div>${incidentTable(state.incidents.slice(0, 8))}</div>`;
}

function operatorNotificationDetails(notification) {
  const message = `${notification.title} ${notification.detail}`;
  const taskId = message.match(/FS-[A-Z0-9-]+/i)?.[0];
  const task = state.fieldTasks.find((item) => item.id === taskId);
  const ticketId = notification.incidentId || message.match(/INC-?[A-Z0-9]+/i)?.[0] || task?.incidentId || "";
  const incident = state.incidents.find((item) => item.id === ticketId);
  const tower = state.towers.find((item) => item.id === incident?.towerId);
  const prioritySeverity = { P1: "High", P2: "High", P3: "Medium", P4: "Low" };
  const type = notification.type || (
    /sla|breach|at risk/i.test(message) ? "SLA Alert"
      : /escalat/i.test(message) ? "Escalation"
        : /new incident|incident created/i.test(message) ? "New Incident"
          : ticketId || /field report|comment|status changed|update/i.test(message) ? "Incident Update" : "System Notification"
  );
  const severity = notification.severity || (
    /\bP[12]\b|breach|escalat/i.test(message) ? "High"
      : /at risk|field report|comment|status changed/i.test(message) ? "Medium"
        : prioritySeverity[incident?.priority] || "Low"
  );
  return {
    type,
    severity,
    category: notification.category || incident?.category || "",
    ticketId,
    area: notification.area || tower?.location || "All Areas",
    status: notification.read ? "Read" : "Unread"
  };
}

function operatorNotificationsFiltered() {
  const query = document.getElementById("operator-notification-filter-search")?.value.trim().toLowerCase() || "";
  const type = document.getElementById("operator-notification-filter-type")?.value || "";
  const severity = document.getElementById("operator-notification-filter-severity")?.value || "";
  const category = document.getElementById("operator-notification-filter-category")?.value || "";
  const area = document.getElementById("operator-notification-filter-area")?.value || "";
  const status = document.getElementById("operator-notification-filter-status")?.value || "";
  const from = document.getElementById("operator-notification-filter-date-from")?.value || "";
  const to = document.getElementById("operator-notification-filter-date-to")?.value || "";

  return [...state.notifications]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .filter((notification) => {
      const details = operatorNotificationDetails(notification);
      const text = `${notification.title} ${notification.detail} ${details.ticketId}`.toLowerCase();
      const created = new Date(notification.at).toISOString().slice(0, 10);
      return (!query || text.includes(query))
        && (!type || details.type === type)
        && (!severity || details.severity === severity)
        && (!category || details.category === category)
        && (!area || details.area === area)
        && (!status || details.status === status)
        && (!from || created >= from)
        && (!to || created <= to);
    });
}

function operatorNotificationTable(notifications) {
  if (!notifications.length) return `<div class="empty">No notifications match these filters.</div>`;
  const allSelected = notifications.every((item) => selectedNotificationIds.has(item.id));
  return `<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="notification-select-all" aria-label="Select all notifications on this page" ${allSelected ? "checked" : ""}></th><th>Date &amp; Time</th><th>Type</th><th>Severity</th><th>Title</th><th>Message</th><th>Related Ticket</th><th>Area</th><th>Status</th><th>Actions</th></tr></thead><tbody>${notifications.map((item) => {
    const details = operatorNotificationDetails(item);
    const timestamp = new Date(item.at).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    return `<tr><td><input type="checkbox" aria-label="Select notification ${esc(item.title)}" data-notification-select="${esc(item.id)}" ${selectedNotificationIds.has(item.id) ? "checked" : ""}></td><td>${timestamp}</td><td>${esc(details.type)}</td><td>${badge(details.severity)}</td><td>${esc(item.title)}</td><td>${esc(item.detail)}</td><td>${esc(details.ticketId || "—")}</td><td>${esc(details.area)}</td><td>${badge(details.status)}</td><td><button class="table-action" data-action="operator-view-notification" data-id="${esc(item.id)}">View</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function operatorNotificationResults(notifications) {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(notifications.length / pageSize));
  operatorNotificationsPage = Math.min(operatorNotificationsPage, pageCount - 1);
  const start = operatorNotificationsPage * pageSize;
  const shown = notifications.slice(start, start + pageSize);
  const firstPage = Math.max(0, Math.min(operatorNotificationsPage - 2, pageCount - 5));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);
  const rangeStart = notifications.length ? start + 1 : 0;
  const rangeEnd = start + shown.length;
  return `${operatorNotificationTable(shown)}
    <div class="panel-head"><span class="muted" id="operator-notification-count">Showing ${rangeStart} to ${rangeEnd} of ${notifications.length} notifications</span><div>
      <button class="btn btn-secondary" data-action="operator-notifications-page" data-page-number="${Math.max(0, operatorNotificationsPage - 1)}" aria-label="Previous page" ${operatorNotificationsPage === 0 ? "disabled" : ""}>‹</button>
      ${notifications.length ? pages.map((page) => `<button class="btn ${page === operatorNotificationsPage ? "btn-primary" : "btn-secondary"}" data-action="operator-notifications-page" data-page-number="${page}" aria-label="Page ${page + 1}" ${page === operatorNotificationsPage ? 'aria-current="page"' : ""}>${page + 1}</button>`).join(" ") : ""}
      <button class="btn btn-secondary" data-action="operator-notifications-page" data-page-number="${Math.min(pageCount - 1, operatorNotificationsPage + 1)}" aria-label="Next page" ${operatorNotificationsPage >= pageCount - 1 ? "disabled" : ""}>›</button>
    </div></div>`;
}

function updateOperatorNotifications() {
  const results = document.getElementById("operator-notification-results");
  if (!results) return;
  results.innerHTML = operatorNotificationResults(operatorNotificationsFiltered());
  const unread = state.notifications.filter((item) => !item.read).length;
  const button = document.querySelector('.top-actions [aria-label="Notifications"]');
  if (button) button.innerHTML = `◌${unread ? `<i class="dot"></i>` : ""}`;
}

function operatorNotificationsView() {
  const types = [...new Set(["SLA Alert", "Incident Update", "Escalation", "New Incident", "System Notification", ...state.notifications.map((item) => operatorNotificationDetails(item).type)])].sort();
  const categories = [...new Set(state.notifications.map((item) => operatorNotificationDetails(item).category).filter(Boolean))].sort();
  const areas = [...new Set(state.notifications.map((item) => operatorNotificationDetails(item).area).filter((area) => area !== "All Areas"))].sort();
  const filters = `<div class="filters" id="operator-notification-filters">
    <div class="form-group"><label for="operator-notification-filter-search">Search</label><input class="search" id="operator-notification-filter-search" aria-label="Search by title, message or ticket ID" placeholder="Search by Title, Message or Ticket ID"></div>
    <div class="form-group"><label for="operator-notification-filter-type">Notification Type</label><select class="field" id="operator-notification-filter-type"><option value="">All Types</option>${types.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-notification-filter-severity">Severity</label><select class="field" id="operator-notification-filter-severity"><option value="">All Severities</option>${["High", "Medium", "Low"].map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-notification-filter-category">Incident Category</label><select class="field" id="operator-notification-filter-category"><option value="">All Categories</option>${categories.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-notification-filter-area">Area</label><select class="field" id="operator-notification-filter-area"><option value="">All Areas</option>${areas.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
    <div class="form-group"><label for="operator-notification-filter-status">Status</label><select class="field" id="operator-notification-filter-status"><option value="">All Statuses</option>${["Unread", "Read"].map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="form-group"><label>Date Range</label><div><input class="field" type="date" id="operator-notification-filter-date-from" aria-label="From date"> <input class="field" type="date" id="operator-notification-filter-date-to" aria-label="To date"></div></div>
    <button class="btn btn-secondary" data-action="reset-operator-notification-filters">Reset</button>
  </div>`;
  return `${pageHead("Notifications", "Stay updated with incident alerts, SLA breaches, escalations and other important notifications.")}
    <div class="panel">${filters}</div>
    <div class="panel"><div class="panel-head"><h2>Notifications (${state.notifications.length})</h2><button class="btn btn-secondary" data-action="mark-all-notifications-read">✓ Mark All as Read</button></div>
      <div id="operator-notification-results">${operatorNotificationResults(operatorNotificationsFiltered())}</div>
    </div>`;
}

function notificationsView() {
  if (state.session === "operator") return operatorNotificationsView();
  return `${pageHead("Notifications", "Alerts, workflow changes and service updates.")}<div class="panel">${state.notifications.length ? state.notifications.map((item) => `<div class="notification ${item.read ? "read" : ""}" data-notification="${item.id}"><div class="notification-icon">◌</div><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>${date(item.at)}</small></div>${item.read ? "" : `<span class="unread-dot"></span>`}</div>`).join("") : `<div class="empty">You are all caught up.</div>`}</div>`;
}

function auditView() {
  return `${pageHead("Audit log", "A traceable history of administrative and workflow actions.")}<div class="panel"><div class="timeline">${state.audit.concat([{ title: "Workspace initialized", actor: "System", at: now() }]).slice(0, 30).map((item) => `<div class="timeline-item"><i class="timeline-dot"></i><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-meta">${esc(item.actor)} · ${date(item.at)}</div></div></div>`).join("")}</div></div>`;
}

function settingsView() {
  return `${pageHead("Profile & settings", "Manage your demo profile and workspace preferences.")}<div class="grid-2"><div class="panel"><div class="panel-head"><h2>Profile</h2></div><div class="form-grid"><div class="form-group"><label>Full name</label><input class="field" value="${currentUser().name}"></div><div class="form-group"><label>Role</label><input disabled class="field" value="${currentUser().label}"></div><div class="form-group"><label>Email</label><input class="field" value="${currentUser().name.toLowerCase().replace(" ", ".")}@example.test"></div><div class="form-group"><label>Timezone</label><select class="field"><option>Asia/Kolkata (IST)</option></select></div></div><div class="form-actions"><button class="btn btn-primary" data-action="save-settings">Save changes</button></div></div><div class="panel"><div class="panel-head"><h2>Workspace preferences</h2></div><label class="check-row"><input type="checkbox" checked> Notify me about SLA warnings</label><label class="check-row"><input type="checkbox" checked> Email field service updates</label><label class="check-row"><input type="checkbox"> Compact data tables</label></div></div>`;
}

function formatSlaDuration(milliseconds) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ") || "under 1m";
}

function operatorIncidentDetail(incident, router, tower, policy, canClose) {
  const slaStatus = operatorDashboardSlaStatus(incident);
  const deadline = incident.status === "Open" ? incident.responseDeadline : incident.resolutionDeadline;
  const remaining = new Date(deadline).getTime() - Date.now();
  const slaDetail = slaStatus === "Breached"
    ? `Breached by ${formatSlaDuration(-remaining)} · ${incident.status === "Open" ? "Response time exceeded" : "Resolution time exceeded"}`
    : slaStatus === "At Risk"
      ? `${formatSlaDuration(remaining)} remaining`
      : "Within target time";
  const priorityLabels = { P1: "P1 - Critical", P2: "P2 - High", P3: "P3 - Medium", P4: "P4 - Low" };
  const createdAt = new Date(incident.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const fields = [
    ["Ticket ID", incident.id],
    ["Status", incident.status],
    ["Title", incident.title],
    ["Priority", priorityLabels[incident.priority] || incident.priority],
    ["Category", incident.category],
    ["Tower", tower ? `${tower.id} (${tower.name})` : "—"],
    ["Created By", incident.createdBy || "Customer"],
    ["Router", router ? `${router.id} (${router.model})` : "—"],
    ["Created Date", createdAt],
    ["Impacted Customers", Number(incident.affected || 0).toLocaleString("en-IN")],
    ["Description", incident.description],
    ["Area", tower?.location || "—"]
  ];
  const information = fields.map(([label, value]) => `<div><span class="muted">${label}</span><strong>${esc(value)}</strong></div>`).join("");
  const responseSla = policy.response < 1 ? `${Math.round(policy.response * 60)} Minutes` : `${policy.response} Hours`;
  const resolutionSla = `${policy.resolution} Hours`;
  const timeline = incident.timeline.map((item) => `<div class="timeline-item"><i class="timeline-dot"></i><div><div class="timeline-title">${esc(item.title)}</div><div class="timeline-meta">${esc(item.actor)} · ${date(item.at)}</div></div></div>`).join("");
  const actionButtons = `<div class="detail-actions">
    ${canClose ? `<button class="btn btn-primary" data-action="close-incident" data-id="${esc(incident.id)}">✓ Resolve</button>` : ""}
    ${incident.status !== "Resolved" && !incident.escalated ? `<button class="btn btn-secondary" data-action="escalate" data-id="${esc(incident.id)}">↗ Escalate</button>` : ""}
    <button class="btn btn-secondary" data-action="refresh-operator-incident-detail" data-id="${esc(incident.id)}">⟳ Refresh</button>
  </div>`;
  const tabContent = operatorIncidentDetailTab === "timeline"
    ? `<div class="panel"><div class="panel-head"><h2>Incident Timeline</h2></div><div class="timeline">${timeline || `<div class="empty">No timeline events available.</div>`}</div></div>`
    : `<div class="panel"><div class="panel-head"><h2>Network Impact Analysis</h2></div><div class="detail-grid">
        <div><span class="muted">Tower</span><strong>${esc(tower ? `${tower.id} · ${tower.name}` : "—")}</strong></div>
        <div><span class="muted">Router</span><strong>${esc(router ? `${router.id} · ${router.model}` : "—")}</strong></div>
        <div><span class="muted">Area</span><strong>${esc(tower?.location || "—")}</strong></div>
        <div><span class="muted">Impacted Customers</span><strong>${Number(incident.affected || 0).toLocaleString("en-IN")}</strong></div>
        <div><span class="muted">Tower Criticality</span><strong>${esc(tower?.criticality || "Not configured")}</strong></div>
        <div><span class="muted">Area Importance</span><strong>${esc(tower?.importance || "Not configured")}</strong></div>
      </div></div>`;
  const tabs = `<div class="filters" role="tablist">
    <button class="btn ${operatorIncidentDetailTab === "impact" ? "btn-primary" : "btn-secondary"}" data-action="operator-incident-detail-tab" data-tab="impact" role="tab" aria-selected="${operatorIncidentDetailTab === "impact"}">Impact Analysis</button>
    <button class="btn ${operatorIncidentDetailTab === "timeline" ? "btn-primary" : "btn-secondary"}" data-action="operator-incident-detail-tab" data-tab="timeline" role="tab" aria-selected="${operatorIncidentDetailTab === "timeline"}">Incident Timeline</button>
  </div>`;
  const slaMessage = `<div class="notice">${badge(`SLA ${slaStatus}`)} <strong>${esc(slaDetail)}</strong></div>`;
  const summary = `${badge(incident.status)} ${badge(priorityLabels[incident.priority] || incident.priority)} ${badge(`SLA ${slaStatus}`)}`;

  return `${pageHead(`${esc(incident.id)} - ${esc(incident.title)}`, summary, actionButtons)}
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><h2>Incident Information</h2></div><div class="detail-grid">${information}</div></div>
      <div class="panel"><div class="panel-head"><h2>SLA Information</h2></div>
        <div class="detail-grid">
          <div><span class="muted">Response SLA</span><strong>${responseSla}</strong></div>
          <div><span class="muted">Resolution SLA</span><strong>${resolutionSla}</strong></div>
        </div>${slaMessage}
      </div>
    </div>
    ${tabs}${tabContent}`;
}

function incidentDetail(incidentId) {
  const incident = state.incidents.find((item) => item.id === incidentId);
  if (!incident || (state.session !== "operator" && !ownsIncident(incident)) || !rolePages().includes("incidents")) return simple("Incident not found", "This incident is not available in your role workspace.", `<button class="btn btn-primary" data-page="dashboard">Back to dashboard</button>`);
  const router = state.routers.find((item) => item.id === incident.routerId);
  const tower = state.towers.find((item) => item.id === incident.towerId);
  const policy = state.policies.find((item) => item.id === incident.priority) || policyFor(incident.affected);
  const canClose = incident.status !== "Resolved" && ((state.session === "operator" && !incident.escalated) || state.session === "lead" || state.session === "admin");
  if (state.session === "operator") return operatorIncidentDetail(incident, router, tower, policy, canClose);
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
    : state.page === "sla-monitoring" ? operatorSlaMonitoringView()
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
    createdBy: currentUser().name,
    createdAt, responseDeadline: new Date(Date.now() + policy.response * 3600000).toISOString(),
    resolutionDeadline: new Date(Date.now() + policy.resolution * 3600000).toISOString(), escalated: false, fieldRequired: false,
    notes: [{ text: "Incident created and SLA allocated automatically.", author: currentUser().name, at: createdAt }],
    timeline: [{ title: `Incident created · ${policy.id} SLA allocated`, actor: currentUser().name, at: createdAt }]
  };
  state.incidents.unshift(incident); log(`Created ${incident.id} with ${policy.id} SLA`); state.notifications.unshift({
    id: id("NT"), title: "New incident created", detail: `${incident.id} is available in the operator queue.`,
    read: false, at: createdAt, type: "New Incident",
    severity: policy.id === "P1" || policy.id === "P2" ? "High" : policy.id === "P3" ? "Medium" : "Low",
    incidentId: incident.id
  }); save();
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
    if (state.session === "operator" && page !== "dashboard") operatorDashboardPage = 0;
    state.page = page; save(); render(); return;
  }
  const incidentRow = event.target.closest("tr[data-incident]");
  if (incidentRow) {
    if (state.session === "operator") operatorIncidentDetailTab = "impact";
    state.page = `detail:${incidentRow.dataset.incident}`; save(); render(); return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "logout") {
    state.session = null;
    save();
    window.location.href = "../../index.html";
    return;
  }
  if (action === "reset-operator-notification-filters") {
    document.querySelectorAll("#operator-notification-filters input, #operator-notification-filters select").forEach((input) => { input.value = ""; });
    selectedNotificationIds.clear();
    operatorNotificationsPage = 0;
    updateOperatorNotifications();
    return;
  }
  if (action === "mark-all-notifications-read") {
    state.notifications.forEach((item) => { item.read = true; });
    save();
    updateOperatorNotifications();
    toast("All notifications marked as read");
    return;
  }
  if (action === "operator-notifications-page") {
    operatorNotificationsPage = Number(event.target.closest("[data-action]").dataset.pageNumber);
    updateOperatorNotifications();
    return;
  }
  if (action === "operator-view-notification") {
    const notification = state.notifications.find((item) => item.id === event.target.closest("[data-action]").dataset.id);
    if (!notification) return toast("Notification is no longer available", "error");
    notification.read = true;
    const details = operatorNotificationDetails(notification);
    save();
    if (details.ticketId && state.incidents.some((item) => item.id === details.ticketId)) {
      operatorIncidentDetailTab = "impact";
      state.page = `detail:${details.ticketId}`;
      render();
      return;
    }
    updateOperatorNotifications();
    toast("Notification marked as read");
    return;
  }
  if (action === "reset-operator-incident-filters") {
    document.querySelectorAll("#operator-incident-filters input, #operator-incident-filters select").forEach((input) => { input.value = ""; });
    operatorIncidentsPage = 0;
    updateOperatorIncidents();
    return;
  }
  if (action === "refresh-operator-incidents") {
    state.incidents = loadState(createSeed).incidents;
    operatorIncidentsPage = 0;
    updateOperatorIncidentsKpis();
    updateOperatorIncidents();
    toast("Incidents refreshed");
    return;
  }
  if (action === "operator-incident-detail-tab") {
    const tab = event.target.closest("[data-action]")?.dataset.tab;
    if (tab === "impact" || tab === "timeline") {
      operatorIncidentDetailTab = tab;
      render();
    }
    return;
  }
  if (action === "refresh-operator-incident-detail") {
    const incidentId = event.target.closest("[data-action]")?.dataset.id;
    state.incidents = loadState(createSeed).incidents;
    if (!state.incidents.some((item) => item.id === incidentId)) {
      state.page = "incidents";
      save();
      render();
      toast("Incident is no longer available", "error");
      return;
    }
    render();
    toast("Incident details refreshed");
    return;
  }
  if (action === "operator-incidents-page") {
    operatorIncidentsPage = Number(event.target.closest("[data-action]").dataset.pageNumber);
    updateOperatorIncidents();
    return;
  }
  if (action === "reset-operator-sla-filters") {
    document.querySelectorAll("#operator-sla-filters input, #operator-sla-filters select").forEach((input) => { input.value = ""; });
    operatorSlaMonitoringPage = 0;
    updateOperatorSlaMonitoring();
    return;
  }
  if (action === "operator-sla-page") {
    operatorSlaMonitoringPage = Number(event.target.closest("[data-action]").dataset.pageNumber);
    updateOperatorSlaMonitoring();
    return;
  }
  if (action === "reset-dashboard-filters") {
    document.querySelectorAll('.filters [id^="operator-dashboard-"]').forEach((input) => { input.value = ""; });
    operatorDashboardPage = 0;
    updateOperatorDashboardTable();
    return;
  }
  if (action === "operator-dashboard-page") {
    operatorDashboardPage = Math.max(0, operatorDashboardPage + Number(event.target.closest("[data-action]").dataset.direction));
    updateOperatorDashboardTable();
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
  if (action === "export") { const csv = ["Incident,Title,Priority,Status,Affected customers", ...state.incidents.map((item) => `${item.id},"${item.title}",${item.priority},${item.status},${item.affected}`)].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "impactflow-incidents.csv"; link.click(); toast("CSV export downloaded"); return; }
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
  if (event.target.id === "task-update-form") { const task = state.fieldTasks.find((item) => item.id === event.target.dataset.id); Object.assign(task, Object.fromEntries(new FormData(event.target))); const incident = state.incidents.find((item) => item.id === task.incidentId); incident?.timeline?.push({ title: "Field request updated", actor: currentUser().name, at: now() }); log(`Updated field request ${task.id}`); save(); document.getElementById("modal")?.remove(); toast("Field request updated"); render(); }
});

document.addEventListener("input", (event) => {
  if (["incident-scope", "incident-router", "incident-tower"].includes(event.target.id)) updateSlaPreview();
  if (event.target.id.startsWith("operator-dashboard-")) { operatorDashboardPage = 0; updateOperatorDashboardTable(); }
  if (event.target.id.startsWith("operator-incidents-")) { operatorIncidentsPage = 0; updateOperatorIncidents(); }
  if (event.target.id.startsWith("operator-sla-filter-")) { operatorSlaMonitoringPage = 0; updateOperatorSlaMonitoring(); }
  if (event.target.id.startsWith("operator-notification-filter-")) { operatorNotificationsPage = 0; updateOperatorNotifications(); }
  if (["incident-search", "status-filter", "priority-filter", "category-filter", "incident-date-picker"].includes(event.target.id)) refreshIncidentResults();
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

document.addEventListener("change", (event) => {
  if (event.target.id === "incident-date-filter") {
    incidentDateFilter().type = event.target.value;
    document.getElementById("incident-date-picker")?.classList.toggle("hidden", event.target.value !== "custom");
    save();
  } else if (event.target.id === "incident-date-picker") {
    incidentDateFilter().date = event.target.value;
    save();
  }
  if (["incident-date-filter", "status-filter", "priority-filter", "category-filter"].includes(event.target.id)) refreshIncidentResults();
  if (event.target.id === "incident-date-picker") refreshIncidentResults();
  if (event.target.id.startsWith("operator-dashboard-")) { operatorDashboardPage = 0; updateOperatorDashboardTable(); }
  if (event.target.id.startsWith("operator-incidents-")) { operatorIncidentsPage = 0; updateOperatorIncidents(); }
  if (event.target.id.startsWith("operator-sla-filter-")) { operatorSlaMonitoringPage = 0; updateOperatorSlaMonitoring(); }
  if (event.target.id.startsWith("operator-notification-filter-")) { operatorNotificationsPage = 0; updateOperatorNotifications(); }
  if (event.target.id === "notification-select-all") {
    const first = operatorNotificationsPage * 10;
    operatorNotificationsFiltered().slice(first, first + 10).forEach((item) => {
      if (event.target.checked) selectedNotificationIds.add(item.id);
      else selectedNotificationIds.delete(item.id);
    });
    updateOperatorNotifications();
    return;
  }
  const selectedNotification = event.target.dataset.notificationSelect;
  if (selectedNotification) {
    if (event.target.checked) selectedNotificationIds.add(selectedNotification);
    else selectedNotificationIds.delete(selectedNotification);
    updateOperatorNotifications();
  }
});

function openModal(html) { document.body.insertAdjacentHTML("beforeend", html); updateSlaPreview(); }
render();
