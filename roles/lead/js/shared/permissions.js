const pages = new Set(["dashboard", "incidents", "escalations", "field", "notifications", "settings"]);
export const canAccess = (page) => pages.has(page);
