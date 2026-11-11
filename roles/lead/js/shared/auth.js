import { roles } from "./roles.js";

export const demoAccounts = {
  admin: { email: "admin@nims.test", password: "Admin@123", ...roles.admin },
  operator: { email: "operator@nims.test", password: "Operator@123", ...roles.operator },
  lead: { email: "lead@nims.test", password: "Lead@123", ...roles.lead },
  engineer: { email: "engineer@nims.test", password: "Engineer@123", ...roles.engineer },
  customer: { email: "customer@nims.test", password: "Customer@123", ...roles.customer }
};

export const authenticate = (email, password) => {
  const entry = Object.entries(demoAccounts).find(([, account]) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password);
  return entry ? { role: entry[0], account: entry[1] } : null;
};
