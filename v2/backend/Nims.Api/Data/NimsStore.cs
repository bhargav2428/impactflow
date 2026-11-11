using System.Text.Json;
using Nims.Api.Models;
using Nims.Api.Security;

namespace Nims.Api.Data;

public sealed class NimsStore(IWebHostEnvironment environment, ILogger<NimsStore> logger) : INimsStore
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _filePath = Path.Combine(environment.ContentRootPath, "App_Data", "nims-store.json");
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true, WriteIndented = true };

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
            if (File.Exists(_filePath)) return;
            await SaveCoreAsync(Seed(), cancellationToken);
            logger.LogInformation("Initialized NIMS data store at {Path}", _filePath);
        }
        finally { _gate.Release(); }
    }

    public async Task<T> ReadAsync<T>(Func<NimsDatabase, T> reader, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var state = await LoadCoreAsync(cancellationToken);
            return reader(state);
        }
        finally { _gate.Release(); }
    }

    public async Task<T> UpdateAsync<T>(Func<NimsDatabase, T> update, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var state = await LoadCoreAsync(cancellationToken);
            var result = update(state);
            await SaveCoreAsync(state, cancellationToken);
            return result;
        }
        finally { _gate.Release(); }
    }

    private async Task<NimsDatabase> LoadCoreAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_filePath)) return Seed();
        await using var stream = File.OpenRead(_filePath);
        return await JsonSerializer.DeserializeAsync<NimsDatabase>(stream, _jsonOptions, cancellationToken) ?? Seed();
    }

    private async Task SaveCoreAsync(NimsDatabase state, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        var temp = _filePath + ".tmp";
        await using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None, 16_384, FileOptions.Asynchronous))
            await JsonSerializer.SerializeAsync(stream, state, _jsonOptions, cancellationToken);
        File.Move(temp, _filePath, true);
    }

    private static NimsDatabase Seed()
    {
        var db = new NimsDatabase();
        var towerInfo = new[]
        {
            ("Koramangala Hub", "Bengaluru"), ("Whitefield East", "Bengaluru"), ("Andheri Central", "Mumbai"),
            ("Salt Lake Sector V", "Kolkata"), ("Hitech City Core", "Hyderabad")
        };
        db.Towers = towerInfo.Select((x, i) => new Tower { Id = $"TWR-{i + 1:000}", Name = x.Item1, Location = x.Item2 }).ToList();
        db.Routers = db.Towers.SelectMany((tower, ti) => Enumerable.Range(1, 3).Select(n => new Router
        {
            Id = $"RTR-{ti + 1}{n}0{n}", TowerId = tower.Id, Model = n == 1 ? "Cisco ASR 920" : "Juniper MX204"
        })).ToList();
        var names = new[] { "Aditi Sharma", "Nexus Retail", "BlueDart Logistics", "Metro Hospitals", "Orbit Finserv", "Kaveri Textiles", "Tata Renewables", "Vistara Foods" };
        db.Customers = Enumerable.Range(0, 40).Select(i => new Customer
        {
            Id = $"CUS-{i + 1:000}", Name = i == 0 ? "Aditi Sharma" : names[i % names.Length] + (i > 7 ? $" {i / 8 + 1}" : ""),
            Email = i == 0 ? "customer@nims.test" : $"account{i + 1}@example.test", PasswordHash = PasswordHasher.Hash(i == 0 ? "Customer@123" : $"Customer{i + 1}@123"),
            Phone = $"+91 90000 {10000 + i}", Address = $"{10 + i}, Business Park, India", RouterId = db.Routers[i % db.Routers.Count].Id
        }).ToList();
        db.Users = new List<User>
        {
            NewUser("USR-001", "Arjun Mehta", "admin@nims.test", "Admin@123", NimsRoles.Admin),
            NewUser("USR-002", "Priya Nair", "operator@nims.test", "Operator@123", NimsRoles.Operator),
            NewUser("USR-003", "Rahul Iyer", "lead@nims.test", "Lead@123", NimsRoles.Lead),
            NewUser("USR-004", "Vikram Singh", "engineer@nims.test", "Engineer@123", NimsRoles.Engineer),
            NewUser("USR-005", "Neeraj Rao", "neeraj@nims.test", "Engineer@123", NimsRoles.Engineer),
            NewUser("USR-006", "Dev Patel", "dev@nims.test", "Operator@123", NimsRoles.Operator),
            NewUser("USR-007", "Sana Khan", "sana@nims.test", "Operator@123", NimsRoles.Operator)
        };
        db.Policies =
        [
            new() { Id = "P4", Range = "1–10", Min = 1, Max = 10, Response = 4, Resolution = 24 },
            new() { Id = "P3", Range = "11–50", Min = 11, Max = 50, Response = 2, Resolution = 12 },
            new() { Id = "P2", Range = "51–200", Min = 51, Max = 200, Response = .5, Resolution = 4 },
            new() { Id = "P1", Range = "201+", Min = 201, Max = 1_000_000, Response = 1d / 6, Resolution = 1 }
        ];
        var statuses = new[] { "Investigating", "Open", "Escalated", "Resolved", "Pending validation" };
        var operators = new[] { "Priya Nair", "Dev Patel", "Sana Khan" };
        db.Incidents = Enumerable.Range(0, 25).Select(i =>
        {
            var router = db.Routers[i % db.Routers.Count];
            var affected = db.Customers.Count(c => c.RouterId == router.Id);
            var policy = db.Policies.First(p => affected >= p.Min && affected <= p.Max);
            var created = DateTimeOffset.UtcNow.AddHours(-i * 3.75);
            var status = statuses[i % statuses.Length];
            var incident = new Incident
            {
                Id = $"INC-{2400 + i:00000}", Title = new[] { "Packet loss detected", "Intermittent connectivity", "Link unavailable", "High latency alert" }[i % 4],
                Description = "Customers are reporting service instability across the affected network segment.",
                Category = new[] { "Connectivity", "Performance", "Hardware" }[i % 3], RouterId = router.Id, TowerId = router.TowerId,
                Status = status, Priority = policy.Id, Affected = affected, Assignee = operators[i % operators.Length], CreatedAt = created,
                ResponseDeadline = created.AddHours(policy.Response), ResolutionDeadline = created.AddHours(policy.Resolution),
                Escalated = status is "Escalated" or "Pending validation", FieldRequired = i % 7 == 0
            };
            incident.Notes.Add(new() { Text = "Incident created and SLA allocated automatically.", Author = "System", At = created });
            incident.Timeline.Add(new() { Title = "Incident created", Actor = "System", At = created });
            return incident;
        }).ToList();
        db.FieldTasks =
        [
            new() { Id = "FS-108", IncidentId = "INC-02402", Engineer = "Vikram Singh", Status = "In progress", Location = "Salt Lake Sector V" },
            new() { Id = "FS-109", IncidentId = "INC-02408", Engineer = "Neeraj Rao", Status = "Scheduled", Location = "Andheri Central" }
        ];
        db.Notifications =
        [
            new() { Id = "NT-1", Title = "P1 SLA breach risk", Detail = "INC-02402 needs immediate review.", Role = NimsRoles.Lead },
            new() { Id = "NT-2", Title = "Field report submitted", Detail = "FS-109 is ready for validation.", Role = NimsRoles.Lead }
        ];
        return db;
    }

    private static User NewUser(string id, string name, string email, string password, string role) =>
        new() { Id = id, Name = name, Email = email, PasswordHash = PasswordHasher.Hash(password), Role = role };
}
