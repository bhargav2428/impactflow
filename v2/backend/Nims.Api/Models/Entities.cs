namespace Nims.Api.Models;

public static class NimsRoles
{
    public const string Admin = "admin";
    public const string Operator = "operator";
    public const string Lead = "lead";
    public const string Engineer = "engineer";
    public const string Customer = "customer";
}

public sealed class NimsDatabase
{
    public List<User> Users { get; set; } = [];
    public List<Customer> Customers { get; set; } = [];
    public List<Tower> Towers { get; set; } = [];
    public List<Router> Routers { get; set; } = [];
    public List<SlaPolicy> Policies { get; set; } = [];
    public List<Incident> Incidents { get; set; } = [];
    public List<FieldTask> FieldTasks { get; set; } = [];
    public List<Notification> Notifications { get; set; } = [];
    public List<AuditEntry> Audit { get; set; } = [];
    public Dictionary<string, UserSettings> Settings { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = NimsRoles.Operator;
    public string Status { get; set; } = "Active";
}

public sealed class Customer
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string RouterId { get; set; } = "";
    public string Status { get; set; } = "Active";
}

public sealed class Tower
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Location { get; set; } = "";
    public string Status { get; set; } = "Active";
}

public sealed class Router
{
    public string Id { get; set; } = "";
    public string TowerId { get; set; } = "";
    public string Model { get; set; } = "";
    public string Status { get; set; } = "Active";
}

public sealed class SlaPolicy
{
    public string Id { get; set; } = "";
    public string Range { get; set; } = "";
    public int Min { get; set; }
    public int Max { get; set; }
    public double Response { get; set; }
    public double Resolution { get; set; }
}

public sealed class Incident
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Category { get; set; } = "Connectivity";
    public string Scope { get; set; } = "router";
    public string RouterId { get; set; } = "";
    public string TowerId { get; set; } = "";
    public int Affected { get; set; }
    public string Priority { get; set; } = "P4";
    public string Status { get; set; } = "Open";
    public string Assignee { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ResponseDeadline { get; set; }
    public DateTimeOffset ResolutionDeadline { get; set; }
    public bool Escalated { get; set; }
    public bool FieldRequired { get; set; }
    public List<IncidentNote> Notes { get; set; } = [];
    public List<TimelineEntry> Timeline { get; set; } = [];
}

public sealed class IncidentNote
{
    public string Text { get; set; } = "";
    public string Author { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class TimelineEntry
{
    public string Title { get; set; } = "";
    public string Actor { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class FieldTask
{
    public string Id { get; set; } = "";
    public string IncidentId { get; set; } = "";
    public string Engineer { get; set; } = "";
    public string Status { get; set; } = "Scheduled";
    public string Location { get; set; } = "";
    public string Diagnosis { get; set; } = "";
    public string Report { get; set; } = "";
    public string Instructions { get; set; } = "";
}

public sealed class Notification
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public bool Read { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public string? UserId { get; set; }
    public string? Role { get; set; }
}

public sealed class AuditEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "";
    public string Actor { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class UserSettings
{
    public bool SlaWarnings { get; set; } = true;
    public bool FieldUpdates { get; set; } = true;
    public bool CompactTables { get; set; }
    public string Timezone { get; set; } = "Asia/Kolkata";
}
