using System.Security.Claims;
using Nims.Api.Data;
using Nims.Api.Models;
using Nims.Api.Security;

namespace Nims.Api.Services;

public sealed class AuthService(INimsStore store, TokenService tokens)
{
    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        var identity = await store.ReadAsync(db =>
        {
            var user = db.Users.FirstOrDefault(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase));
            if (user is not null) return user.Status == "Active" && PasswordHasher.Verify(request.Password, user.PasswordHash)
                ? (Id: user.Id, Name: user.Name, Email: user.Email, Role: user.Role, Status: user.Status) : default;
            var customer = db.Customers.FirstOrDefault(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase));
            if (customer is not null) return customer.Status == "Active" && PasswordHasher.Verify(request.Password, customer.PasswordHash)
                ? (Id: customer.Id, Name: customer.Name, Email: customer.Email, Role: NimsRoles.Customer, Status: customer.Status) : default;
            return default;
        }, ct);
        if (identity.Id is null) throw new ApiException(401, "Email or password is incorrect.");
        var (token, expires) = tokens.Create(identity.Id, identity.Name, identity.Email, identity.Role);
        return new(token, expires, ToSummary(identity.Id, identity.Name, identity.Email, identity.Role, identity.Status));
    }

    public async Task<AuthResponse> CurrentAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var id = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        var user = await store.ReadAsync(db =>
        {
            var employee = db.Users.FirstOrDefault(x => x.Id == id);
            if (employee is not null) return ToSummary(employee.Id, employee.Name, employee.Email, employee.Role, employee.Status);
            var customer = db.Customers.FirstOrDefault(x => x.Id == id);
            return customer is null ? null : ToSummary(customer.Id, customer.Name, customer.Email, NimsRoles.Customer, customer.Status);
        }, ct);
        if (user is null || user.Status != "Active") throw new ApiException(401, "This account is no longer active.");
        return new(user);
    }

    public static UserSummary ToSummary(string id, string name, string email, string role, string status) =>
        new(id, name, email, role, role switch
        {
            NimsRoles.Admin => "Network Admin", NimsRoles.Operator => "Network Operator", NimsRoles.Lead => "Technical Lead",
            NimsRoles.Engineer => "Field Engineer", NimsRoles.Customer => "Customer", _ => role
        }, string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(x => x[0])).ToUpperInvariant(), status);
}
