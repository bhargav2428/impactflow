using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Nims.Api.Models;

public sealed record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public sealed record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, UserSummary User);
public sealed record UserSummary(string Id, string Name, string Email, string Role, string Label, string Initials, string Status);
public sealed record AuthResponse(UserSummary User);

public sealed class UserWriteRequest
{
    [Required, MinLength(2), MaxLength(120)] public string Name { get; set; } = "";
    [Required, EmailAddress, MaxLength(254)] public string Email { get; set; } = "";
    [MinLength(8), MaxLength(200)] public string? Password { get; set; }
    [Required] public string Role { get; set; } = NimsRoles.Operator;
    [Required] public string Status { get; set; } = "Active";
}

public sealed class CustomerWriteRequest
{
    [Required, MinLength(2), MaxLength(120)] public string Name { get; set; } = "";
    [Required, EmailAddress, MaxLength(254)] public string Email { get; set; } = "";
    [MinLength(8), MaxLength(200)] public string? Password { get; set; }
    [MaxLength(40)] public string Phone { get; set; } = "";
    [MaxLength(300)] public string Address { get; set; } = "";
    [Required] public string RouterId { get; set; } = "";
    [Required] public string Status { get; set; } = "Active";
}

public sealed class TowerWriteRequest
{
    [Required, MinLength(2), MaxLength(120)] public string Name { get; set; } = "";
    [Required, MinLength(2), MaxLength(120)] public string Location { get; set; } = "";
    [Required] public string Status { get; set; } = "Active";
}

public sealed class RouterWriteRequest
{
    [Required, RegularExpression(@"^[A-Za-z0-9_-]{2,40}$")] public string Id { get; set; } = "";
    [Required] public string TowerId { get; set; } = "";
    [Required, MaxLength(120)] public string Model { get; set; } = "";
    [Required] public string Status { get; set; } = "Active";
}

public sealed class SlaPolicyWriteRequest
{
    [Required, RegularExpression(@"^P[1-4]$")] public string Id { get; set; } = "";
    [Required, MaxLength(40)] public string Range { get; set; } = "";
    [Range(1, 1000000)] public int Min { get; set; }
    [Range(1, 1000000)] public int Max { get; set; }
    [Range(0.1, 8760)] public double Response { get; set; }
    [Range(0.1, 8760)] public double Resolution { get; set; }
}

public sealed class IncidentCreateRequest
{
    [Required, MinLength(3), MaxLength(160)] public string Title { get; set; } = "";
    [Required, MinLength(3), MaxLength(4000)] public string Description { get; set; } = "";
    [Required] public string Category { get; set; } = "Connectivity";
    [Required] public string Scope { get; set; } = "router";
    [Required] public string RouterId { get; set; } = "";
    [Required] public string TowerId { get; set; } = "";
}

public sealed record NoteRequest([Required, MinLength(2), MaxLength(4000)] string Text);
public sealed record FieldTaskWriteRequest([Required] string IncidentId, [Required] string Engineer, [MaxLength(4000)] string Instructions = "");
public sealed record FieldReportRequest([Required] string Status, [Required, MinLength(2), MaxLength(4000)] string Report, [MaxLength(4000)] string Diagnosis = "");
public sealed record FieldTaskStatusRequest([Required] string Status);
public sealed record SettingsWriteRequest(bool SlaWarnings, bool FieldUpdates, bool CompactTables, string Timezone = "Asia/Kolkata");
public sealed record ReadStateRequest(bool Read = true);

public sealed record IncidentCreateResponse(Incident Incident, SlaPolicy Policy);
public sealed record DashboardResponse(string Role, IReadOnlyDictionary<string, object> Stats, IReadOnlyList<Incident> Incidents, IReadOnlyList<FieldTask> FieldTasks);
public sealed record ReportsResponse(int TotalIncidents, int OpenIncidents, int ResolvedIncidents, int SlaBreaches, IReadOnlyDictionary<string, int> ByCategory, IReadOnlyDictionary<string, int> ByPriority);
public sealed record NetworkSummaryResponse(
    IReadOnlyList<Tower> Towers,
    IReadOnlyList<Router> Routers,
    IReadOnlyList<NetworkCustomerSummary> Customers,
    IReadOnlyList<NetworkEngineerSummary> Engineers);
public sealed record NetworkEngineerSummary(string Id, string Name, string Status);
public sealed record NetworkCustomerSummary(
    string Id,
    string Name,
    string RouterId,
    string Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Email = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Phone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Address = null);

public sealed class ApiException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
