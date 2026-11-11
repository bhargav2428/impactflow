export const selectPolicy = (policies, affectedCustomers) => policies.find((policy) => affectedCustomers >= policy.min && affectedCustomers <= policy.max) || policies[policies.length - 1];

export const affectedCustomersFor = (state, scope, towerId, routerId) => scope === "tower"
  ? state.customers.filter((customer) => state.routers.some((router) => router.towerId === towerId && router.id === customer.routerId)).length
  : state.customers.filter((customer) => customer.routerId === routerId).length;
