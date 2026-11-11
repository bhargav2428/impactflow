export const leadDashboard = {
  title: "Technical lead workspace",
  subtitle: "Validate escalations, coordinate field service and close technically resolved incidents.",
  primaryAction: "escalations",
  stats: [
    ["Escalated incidents", (state) => state.incidents.filter((item) => item.escalated).length, "Awaiting technical review"],
    ["Pending validation", (state) => state.incidents.filter((item) => item.status === "Pending validation").length, "Review operator work"],
    ["Field requests", (state) => state.fieldTasks.filter((item) => item.status !== "Completed").length, "Open work orders"],
    ["Active engineers", () => 3, "Of 4 available"]
  ],
  panels: ["lead-escalations", "lead-field", "lead-breaches"]
};

export const leadNavigation = ["dashboard", "incidents", "escalations", "field", "notifications", "settings"];
