export const adminDashboard = {
  title: "Network command center",
  subtitle: "Manage infrastructure, people, policy and service quality from one workspace.",
  primaryAction: "infrastructure",
  stats: [
    ["Towers", (state) => state.towers.length, "Infrastructure inventory"],
    ["Routers", (state) => state.routers.length, "Across all tower sites"],
    ["Customers", (state) => state.customers.length, "Mapped accounts"],
    ["Network operators", (state) => state.users.filter((user) => user.role === "operator" && user.status === "Active").length, "Active users"],
    ["Technical leads", (state) => state.users.filter((user) => user.role === "lead" && user.status === "Active").length, "Active users"],
    ["Field engineers", (state) => state.users.filter((user) => user.role === "engineer" && user.status === "Active").length, "Active users"],
    ["Active incidents", (state) => state.incidents.filter((item) => item.status !== "Resolved").length, "Across the network"],
    ["SLA breaches", (state) => state.incidents.filter((item) => item.status !== "Resolved" && new Date(item.resolutionDeadline) < new Date()).length, "Needs attention"]
  ],
  panels: ["incident-overview", "infrastructure-health", "admin-queue"]
};

export const adminNavigation = ["dashboard", "incidents", "infrastructure", "towers", "routers", "users", "customers", "sla", "reports", "audit"];
