export const operatorDashboard = {
  title: "Operator workspace",
  subtitle: "Investigate assigned incidents, capture troubleshooting notes and resolve eligible tickets.",
  primaryAction: "incidents",
  stats: [
    ["Assigned incidents", (state) => state.incidents.filter((item) => item.assignee === "Priya Nair" && item.status !== "Resolved").length, "Your active queue"],
    ["New incidents", (state) => state.incidents.filter((item) => item.status === "Open").length, "Ready to investigate"],
    ["Escalated", (state) => state.incidents.filter((item) => item.escalated).length, "Lead review required"],
    ["SLA attention", (state) => state.incidents.filter((item) => item.status !== "Resolved" && new Date(item.resolutionDeadline) < new Date()).length, "Respond before breach"]
  ],
  panels: ["operator-queue", "operator-sla", "operator-activity"]
};

export const operatorNavigation = ["dashboard", "incidents", "notifications", "settings"];
