const pages = new Set(["dashboard", "incidents", "infrastructure", "towers", "routers", "users", "customers", "sla", "reports", "audit"]);
export const canAccess = (page) => pages.has(page);
