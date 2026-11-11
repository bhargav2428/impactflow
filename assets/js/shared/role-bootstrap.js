export async function startRolePage(role) {
  window.NIMS_ROLE_PAGE = role;
  await import("../app.js");
}
