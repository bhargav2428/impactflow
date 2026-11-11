export const pageAccess = {
  dashboard: ["admin", "operator", "lead", "engineer", "customer"],
  incidents: ["operator", "lead", "customer"],
  create: ["customer"],
  escalations: ["lead", "operator"],
  field: ["lead", "engineer"],
  infrastructure: ["admin"],
  towers: ["admin"],
  routers: ["admin"],
  customers: ["admin"],
  users: ["admin"],
  sla: ["admin"],
  reports: ["admin"],
  audit: ["admin"]
};

export const canAccess = (page, role) => !pageAccess[page] || pageAccess[page].includes(role);
