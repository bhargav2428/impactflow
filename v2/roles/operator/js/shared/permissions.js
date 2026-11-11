const pages = new Set(["dashboard", "incidents", "notifications", "settings"]);
export const canAccess = (page) => pages.has(page);
