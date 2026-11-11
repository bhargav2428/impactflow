export const customerDashboard = {
  title: "Customer service workspace",
  subtitle: "Raise tickets, track progress and view resolution details for your account.",
  primaryAction: "create",
  stats: [
    ["Active incidents", (state) => customerIncidents(state).filter((item) => item.status !== "Resolved").length, "Currently being handled"],
    ["Pending tickets", (state) => customerIncidents(state).filter((item) => ["Open", "Investigating"].includes(item.status)).length, "Awaiting resolution"],
    ["Resolved incidents", (state) => customerIncidents(state).filter((item) => item.status === "Resolved").length, "Service history"],
    ["Account status", () => "Active", "Managed network account"]
  ],
  panels: ["customer-tickets", "customer-impact", "customer-history"]
};

export const customerNavigation = ["dashboard", "incidents", "create", "notifications", "settings"];

const customerIncidents = (state) => {
  const account = state.customers.find((customer) => customer.name === "Aditi Sharma");
  return account ? state.incidents.filter((incident) => incident.routerId === account.routerId) : [];
};
