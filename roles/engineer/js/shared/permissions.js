const pages = new Set(["dashboard", "field", "notifications", "settings"]);
export const canAccess = (page) => pages.has(page);
