const pages = new Set(["dashboard", "infrastructure", "towers", "routers", "users", "customers", "sla", "reports", "audit"]);
export const canAccess = (page) => pages.has(page);
