using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.WebUtilities;
using System.Text.Encodings.Web;
using Nims.Api.Data;
using Nims.Api.Models;

namespace Nims.Api.Security;

public sealed class TokenService(IWebHostEnvironment environment, IConfiguration configuration)
{
    private readonly byte[] _key = LoadKey(environment, configuration);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public (string Token, DateTimeOffset ExpiresAt) Create(string id, string name, string email, string role)
    {
        var expires = DateTimeOffset.UtcNow.AddHours(8);
        var header = Encode(JsonSerializer.SerializeToUtf8Bytes(new { alg = "HS256", typ = "JWT" }, JsonOptions));
        var payload = Encode(JsonSerializer.SerializeToUtf8Bytes(new { sub = id, name, email, role, exp = expires.ToUnixTimeSeconds(), iss = "nims-api" }, JsonOptions));
        var signingInput = $"{header}.{payload}";
        using var hmac = new HMACSHA256(_key);
        var signature = Encode(hmac.ComputeHash(Encoding.ASCII.GetBytes(signingInput)));
        return ($"{signingInput}.{signature}", expires);
    }

    public ClaimsPrincipal? Validate(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3) return null;
        try
        {
            var signingInput = $"{parts[0]}.{parts[1]}";
            using var hmac = new HMACSHA256(_key);
            var signature = WebEncoders.Base64UrlDecode(parts[2]);
            if (!CryptographicOperations.FixedTimeEquals(hmac.ComputeHash(Encoding.ASCII.GetBytes(signingInput)), signature)) return null;
            using var payload = JsonDocument.Parse(WebEncoders.Base64UrlDecode(parts[1]));
            var root = payload.RootElement;
            if (root.GetProperty("iss").GetString() != "nims-api" || root.GetProperty("exp").GetInt64() <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return null;
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, root.GetProperty("sub").GetString() ?? ""),
                new Claim(ClaimTypes.Name, root.GetProperty("name").GetString() ?? ""),
                new Claim(ClaimTypes.Email, root.GetProperty("email").GetString() ?? ""),
                new Claim(ClaimTypes.Role, root.GetProperty("role").GetString() ?? "")
            };
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
        }
        catch (Exception ex) when (ex is FormatException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return null;
        }
    }

    private static string Encode(byte[] bytes) => WebEncoders.Base64UrlEncode(bytes);

    private static byte[] LoadKey(IWebHostEnvironment environment, IConfiguration configuration)
    {
        var configured = configuration["Nims:SigningKey"];
        if (!string.IsNullOrWhiteSpace(configured) && Encoding.UTF8.GetByteCount(configured) >= 32) return SHA256.HashData(Encoding.UTF8.GetBytes(configured));
        var path = Path.Combine(environment.ContentRootPath, "App_Data", "token-signing.key");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path)) return Convert.FromBase64String(File.ReadAllText(path).Trim());
        var key = RandomNumberGenerator.GetBytes(32);
        File.WriteAllText(path, Convert.ToBase64String(key));
        return key;
    }
}

public sealed class BearerTokenHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    TokenService tokens,
    NimsStore store) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return AuthenticateResult.NoResult();
        var principal = tokens.Validate(header[7..].Trim());
        if (principal is null) return AuthenticateResult.Fail("Invalid or expired bearer token.");
        var id = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        var access = await store.ReadAsync(db =>
        {
            var user = db.Users.FirstOrDefault(x => x.Id == id);
            if (user is not null) return user.Status == "Active" ? new AccountAccess(user.Name, user.Email, user.Role) : null;
            var customer = db.Customers.FirstOrDefault(x => x.Id == id);
            return customer is not null && customer.Status == "Active" ? new AccountAccess(customer.Name, customer.Email, NimsRoles.Customer) : null;
        }, Context.RequestAborted);
        if (access is null || access.Role != principal.FindFirstValue(ClaimTypes.Role)) return AuthenticateResult.Fail("This account is no longer active or its role has changed.");
        if (principal.Identity is ClaimsIdentity identity)
        {
            Replace(identity, ClaimTypes.Name, access.Name);
            Replace(identity, ClaimTypes.Email, access.Email);
        }
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }

    private static void Replace(ClaimsIdentity identity, string type, string value)
    {
        foreach (var claim in identity.FindAll(type).ToArray()) identity.RemoveClaim(claim);
        identity.AddClaim(new Claim(type, value));
    }

    private sealed record AccountAccess(string Name, string Email, string Role);
}
