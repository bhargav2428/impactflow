import { api, setToken } from "./js/api.js";

const accounts = {
  admin: { label: "Network Admin", name: "Arjun Mehta", initials: "AM", email: "admin@nims.test", password: "Admin@123" },
  operator: { label: "Network Operator", name: "Priya Nair", initials: "PN", email: "operator@nims.test", password: "Operator@123" },
  lead: { label: "Technical Lead", name: "Rahul Iyer", initials: "RI", email: "lead@nims.test", password: "Lead@123" },
  engineer: { label: "Field Engineer", name: "Vikram Singh", initials: "VS", email: "engineer@nims.test", password: "Engineer@123" },
  customer: { label: "Customer", name: "Aditi Sharma", initials: "AS", email: "customer@nims.test", password: "Customer@123" }
};

const rolePage = (role) => `roles/${role}/index.html`;
const app = document.getElementById("app");

app.innerHTML = `<main class="login-screen"><section class="login-card"><div class="brand"><div class="brand-mark">N</div><div><strong>NIMS</strong><small>Network operations</small></div></div><h1>Welcome back</h1><p class="subhead">Sign in to your network operations workspace.</p><form id="login-form"><div class="form-group"><label for="email">Work email</label><input id="email" name="email" class="field" type="email" autocomplete="username" placeholder="you@nims.test" required></div><div class="form-group"><label for="password">Password</label><input id="password" name="password" class="field" type="password" autocomplete="current-password" placeholder="Enter your password" required></div><p id="login-error" class="login-error hidden">Invalid email or password.</p><button class="btn" type="submit">Sign in to NIMS →</button></form><div class="demo-note"><strong>Demo accounts</strong><br>Choose a role to autofill its credentials:<select id="demo-role" class="field"><option value="">Choose a role</option>${Object.entries(accounts).map(([role, account]) => `<option value="${role}">${account.label} · ${account.email}</option>`).join("")}</select><span class="demo-credentials">Demo credentials for the local API.</span></div></section></main>`;

document.getElementById("demo-role").addEventListener("change", (event) => {
  const account = accounts[event.target.value];
  if (!account) return;
  document.getElementById("email").value = account.email;
  document.getElementById("password").value = account.password;
  document.getElementById("login-error").classList.add("hidden");
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const result = await api.post("/api/auth/login", { email: values.email.trim(), password: values.password }, { token: null });
    setToken(result.accessToken);
    window.location.href = rolePage(result.user.role);
  } catch (error) {
    document.getElementById("login-error").textContent = error.status === 0
      ? "Could not reach the NIMS API. Start the backend and try again."
      : error.message;
    document.getElementById("login-error").classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
});
