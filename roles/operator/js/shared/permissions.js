const pages = new Set(["dashboard", "incidents", "sla-monitoring", "notifications", "reports", "settings"]);
export const canAccess = (page, session) => pages.has(page) && (page !== "reports" || session === "operator");
