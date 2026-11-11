export const engineerDashboard = {
  title: "Field engineer workspace",
  subtitle: "Review assigned incident tickets, accept the work and submit updates for verification.",
  primaryAction: "request-instrument",
  stats: [
    ["Assigned tasks", (state) => state.fieldTasks.filter((item) => item.engineer === (state.authUser?.name || "Vikram Singh")).length, "Your work queue"],
    ["Pending visits", (state) => state.fieldTasks.filter((item) => item.engineer === (state.authUser?.name || "Vikram Singh") && item.status === "Scheduled").length, "Scheduled on site"],
    ["In progress", (state) => state.fieldTasks.filter((item) => item.engineer === (state.authUser?.name || "Vikram Singh") && item.status === "In progress").length, "Currently active"],
    ["Completed work", (state) => state.fieldTasks.filter((item) => item.engineer === (state.authUser?.name || "Vikram Singh") && item.status === "Completed").length, "Verified reports"]
  ],
  panels: ["engineer-tasks", "engineer-sites", "engineer-updates"]
};

export const engineerNavigation = ["dashboard", "incidents", "field", "notifications", "settings"];
