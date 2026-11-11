const pages = new Set(["dashboard", "incidents", "create", "notifications", "settings"]);
export const canAccess = (page) => pages.has(page);
