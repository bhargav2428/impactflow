import { adminDashboard, adminNavigation } from "./admin.js";
import { operatorDashboard, operatorNavigation } from "./operator.js";
import { leadDashboard, leadNavigation } from "./lead.js";
import { engineerDashboard, engineerNavigation } from "./engineer.js";
import { customerDashboard, customerNavigation } from "./customer.js";

export const roleDashboards = { admin: adminDashboard, operator: operatorDashboard, lead: leadDashboard, engineer: engineerDashboard, customer: customerDashboard };
export const roleNavigation = { admin: adminNavigation, operator: operatorNavigation, lead: leadNavigation, engineer: engineerNavigation, customer: customerNavigation };
