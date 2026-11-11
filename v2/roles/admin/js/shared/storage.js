import { api, setToken } from "../../../../js/api.js";

let baseline = null;
let writeQueue = Promise.resolve();

const copy = (value) => JSON.parse(JSON.stringify(value));
const optional = async (path) => {
  try { return await api.get(path); }
  catch (error) { if ([403, 404].includes(error.status)) return null; throw error; }
};
const mapById = (items = []) => new Map(items.map((item) => [item.id, item]));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export async function loadState(seed) {
  if (!sessionStorage.getItem("nims-api-token")) {
    window.location.replace("../../../index.html");
    return seed();
  }
  try {
    const identity = await api.get("/api/auth/me");
    const user = identity.user;
    if (user.role !== window.NIMS_ROLE_PAGE) {
      window.location.replace(`../../../roles/${user.role}/index.html`);
      return seed();
    }
    const state = seed();
    const [dashboard, network, users, policies, incidents, fieldTasks, notifications, audit, reports, settings] = await Promise.all([
      api.get("/api/dashboard"),
      optional("/api/network/summary"),
      user.role === "admin" ? api.get("/api/users") : Promise.resolve(null),
      optional("/api/sla-policies"),
      user.role === "engineer" ? Promise.resolve(null) : api.get("/api/incidents"),
      ["admin", "lead", "engineer"].includes(user.role) ? api.get("/api/field-tasks") : Promise.resolve(null),
      api.get("/api/notifications"),
      user.role === "admin" ? api.get("/api/audit") : Promise.resolve(null),
      user.role === "admin" ? api.get("/api/reports") : Promise.resolve(null),
      api.get("/api/settings")
    ]);
    state.session = user.role;
    state.authUser = user;
    state.incidents = incidents || dashboard.incidents || [];
    state.fieldTasks = fieldTasks || dashboard.fieldTasks || [];
    state.notifications = notifications || [];
    state.towers = network?.towers || [];
    state.routers = network?.routers || [];
    state.customers = network?.customers || [];
    state.users = users || (network?.engineers || []).map((engineer) => ({ ...engineer, role: "engineer" }));
    state.policies = policies || [];
    state.audit = audit || [];
    state.reports = reports;
    state.settings = settings;
    state.dashboardStats = dashboard.stats || {};
    state.page = "dashboard";
    baseline = copy(state);
    return state;
  } catch (error) {
    if (error.status === 401) setToken(null);
    window.dispatchEvent(new CustomEvent("nims-api-error", { detail: error }));
    window.location.replace("../../../index.html");
    return seed();
  }
}

async function persistEntityList(state, baseState, key, path, serialize, { softDelete = false } = {}) {
  const before = mapById(baseState[key]);
  for (const item of state[key] || []) {
    const prior = before.get(item.id);
    if (!prior) {
      const result = await api.post(path, serialize(item));
      if (result?.id) item.id = result.id;
      continue;
    }
    if (same(prior, item)) continue;
    if (softDelete && item.status === "Inactive") await api.delete(`${path}/${encodeURIComponent(item.id)}`);
    else await api.put(`${path}/${encodeURIComponent(item.id)}`, serialize(item));
  }
}

async function persist(state) {
  if (!baseline) { baseline = copy(state); return; }
  const old = baseline;
  await persistEntityList(state, old, "towers", "/api/towers", ({ name, location, status }) => ({ name, location, status }));
  await persistEntityList(state, old, "routers", "/api/routers", ({ id, towerId, model, status }) => ({ id, towerId, model, status }));
  await persistEntityList(state, old, "users", "/api/users", ({ name, email, password, role, status }) => ({ name, email, ...(password ? { password } : {}), role, status }), { softDelete: true });
  await persistEntityList(state, old, "customers", "/api/customers", ({ name, email, password, phone = "", address = "", routerId, status }) => ({ name, email, ...(password ? { password } : {}), phone, address, routerId, status }));
  await persistEntityList(state, old, "policies", "/api/sla-policies", ({ id, range, min, max, response, resolution }) => ({ id, range, min, max, response, resolution }));

  const oldIncidents = mapById(old.incidents);
  for (const incident of state.incidents || []) {
    const prior = oldIncidents.get(incident.id);
    if (!prior) {
      const result = await api.post("/api/incidents", { title: incident.title, description: incident.description, category: incident.category, scope: incident.scope, routerId: incident.routerId, towerId: incident.towerId });
      if (result?.incident) {
        const oldId = incident.id;
        Object.assign(incident, result.incident);
        if (state.page === `detail:${oldId}`) state.page = `detail:${incident.id}`;
      }
      continue;
    }
    if (incident.notes.length > prior.notes.length) {
      const note = incident.notes.at(-1);
      await api.post(`/api/incidents/${encodeURIComponent(incident.id)}/notes`, { text: note.text });
    }
    if (incident.status !== prior.status) {
      if (incident.status === "Escalated") await api.post(`/api/incidents/${encodeURIComponent(incident.id)}/escalate`);
      else if (incident.status === "Pending validation") await api.post(`/api/incidents/${encodeURIComponent(incident.id)}/validate`);
      else if (incident.status === "Resolved") await api.post(`/api/incidents/${encodeURIComponent(incident.id)}/resolve`);
    }
  }

  const oldTasks = mapById(old.fieldTasks);
  for (const task of state.fieldTasks || []) {
    const prior = oldTasks.get(task.id);
    if (!prior) {
      const result = await api.post("/api/field-tasks", { incidentId: task.incidentId, engineer: task.engineer, instructions: task.instructions || "" });
      if (result?.id) task.id = result.id;
      continue;
    }
    if (task.engineer !== prior.engineer || task.instructions !== prior.instructions) {
      await api.post("/api/field-tasks", { incidentId: task.incidentId, engineer: task.engineer, instructions: task.instructions || "" });
    }
    if (task.status !== prior.status || task.report !== prior.report || task.diagnosis !== prior.diagnosis) {
      if (task.status === "Completed") await api.post(`/api/field-tasks/${encodeURIComponent(task.id)}/verify`);
      else if (task.status === "Rejected") await api.post(`/api/field-tasks/${encodeURIComponent(task.id)}/reject`);
      else if (task.status === "In progress" || task.status === "Report submitted") {
        await api.put(`/api/field-tasks/${encodeURIComponent(task.id)}/report`, { status: task.status, report: task.report || "Update in progress", diagnosis: task.diagnosis || "" });
      }
    }
  }

  const oldNotifications = mapById(old.notifications);
  for (const notification of state.notifications || []) {
    if (!oldNotifications.get(notification.id)?.read && notification.read) await api.patch(`/api/notifications/${encodeURIComponent(notification.id)}/read`, {});
  }
  baseline = copy(state);
}

export function saveState(state) {
  writeQueue = writeQueue.then(async () => {
    await persist(state);
    window.dispatchEvent(new CustomEvent("nims-state-synced"));
  }).catch((error) => {
    window.dispatchEvent(new CustomEvent("nims-api-error", { detail: error }));
  });
  return writeQueue;
}

export async function saveSettings(settings) {
  const saved = await api.put("/api/settings", settings);
  if (baseline) baseline.settings = copy(saved);
  return saved;
}

export async function signOut() {
  try { await api.post("/api/auth/logout", {}); }
  finally { setToken(null); }
}
