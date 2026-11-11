const accounts = {
  admin: { label: "Network Admin", name: "Arjun Mehta", initials: "AM", email: "admin@nims.test", password: "Admin@123" },
  operator: { label: "Network Operator", name: "Priya Nair", initials: "PN", email: "operator@nims.test", password: "Operator@123" },
  lead: { label: "Technical Lead", name: "Rahul Iyer", initials: "RI", email: "lead@nims.test", password: "Lead@123" },
  engineer: { label: "Field Engineer", name: "Vikram Singh", initials: "VS", email: "engineer@nims.test", password: "Engineer@123" },
  customer: { label: "Customer", name: "Aditi Sharma", initials: "AS", email: "customer@nims.test", password: "Customer@123" }
};

const rolePage = (role) => `roles/${role}/index.html`;
const roleLabels = { admin: "Network Admin", operator: "Network Operator", lead: "Technical Lead", engineer: "Field Engineer", customer: "Customer" };
const initials = (name = "") => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const app = document.getElementById("app");
const storedState = JSON.parse(localStorage.getItem("nims-state-v2") || "null");
const storedAccounts = [
  ...(storedState?.users || []).map((user) => ({ label: roleLabels[user.role] || user.role, name: user.name, initials: initials(user.name), role: user.role, email: user.email, password: user.password, status: user.status })),
  ...(storedState?.customers || []).map((customer) => ({ label: "Customer", name: customer.name, initials: initials(customer.name), role: "customer", email: customer.email, password: customer.password, status: customer.status }))
].filter((account) => account.email && account.password && account.status !== "Inactive");
const availableAccounts = [...storedAccounts, ...Object.entries(accounts).map(([role, account]) => ({ ...account, role }))];

app.innerHTML = `<main class="login-screen"><section class="login-card"><div class="brand"><div class="brand-mark">I</div><div><strong>ImpactFlow</strong><small>Network operations</small></div></div><h1>Welcome back</h1><p class="subhead">Sign in to your network operations workspace.</p><form id="login-form"><div class="form-group"><label for="email">Work email</label><input id="email" name="email" class="field" type="email" autocomplete="username" placeholder="you@nims.test" required></div><div class="form-group"><label for="password">Password</label><input id="password" name="password" class="field" type="password" autocomplete="current-password" placeholder="Enter your password" required></div><p id="login-error" class="login-error hidden">Invalid email or password.</p><button class="btn" type="submit">Sign in to ImpactFlow →</button></form><div class="demo-note"><strong>Demo accounts</strong><br>Choose a role to autofill its credentials:<select id="demo-role" class="field"><option value="">Choose a role</option>${Object.entries(accounts).map(([role, account]) => `<option value="${role}">${account.label} · ${account.email}</option>`).join("")}</select><span class="demo-credentials">Demo only · no backend authentication is connected.</span></div></section></main>`;

document.getElementById("demo-role").addEventListener("change", (event) => {
  const account = accounts[event.target.value];
  if (!account) return;
  document.getElementById("email").value = account.email;
  document.getElementById("password").value = account.password;
  document.getElementById("login-error").classList.add("hidden");
});

document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
    const match = availableAccounts.find((account) => account.email.toLowerCase() === values.email.trim().toLowerCase() && account.password === values.password);
  if (!match) {
    document.getElementById("login-error").classList.remove("hidden");
    return;
  }
  localStorage.setItem("nims-auth-session", JSON.stringify({ role: match.role, name: match.name || match.label, initials: match.initials || initials(match.name || match.label), label: match.label, email: match.email }));
  window.location.href = rolePage(match.role);
});
