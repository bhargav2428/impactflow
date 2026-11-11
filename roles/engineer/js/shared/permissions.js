const pages = new Set(["dashboard", "incidents", "field", "notifications", "settings"]);
export const canAccess = (page) => pages.has(page);
