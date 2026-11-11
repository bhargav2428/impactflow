using System.Security.Claims;
using Nims.Api.Data;
using Nims.Api.Models;

namespace Nims.Api.Services;

public sealed record Actor(string Id, string Name, string Role)
{
    public static Actor From(ClaimsPrincipal principal) => new(
        principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "",
        principal.FindFirstValue(ClaimTypes.Name) ?? "",
        principal.FindFirstValue(ClaimTypes.Role) ?? "");
}

public sealed class NimsService(INimsStore store)
{
    private static readonly HashSet<string> Roles = [NimsRoles.Admin, NimsRoles.Operator, NimsRoles.Lead, NimsRoles.Engineer, NimsRoles.Customer];
    private static readonly HashSet<string> Statuses = ["Active", "Inactive"];

    public Task<IReadOnlyList<Tower>> GetTowersAsync(CancellationToken ct) => store.ReadAsync(db => (IReadOnlyList<Tower>)db.Towers.OrderBy(x => x.Name).ToList(), ct);
    public Task<IReadOnlyList<Router>> GetRoutersAsync(CancellationToken ct) => store.ReadAsync(db => (IReadOnlyList<Router>)db.Routers.OrderBy(x => x.Id).ToList(), ct);
    public Task<IReadOnlyList<SlaPolicy>> GetPoliciesAsync(CancellationToken ct) => store.ReadAsync(db => (IReadOnlyList<SlaPolicy>)db.Policies.OrderBy(x => x.Min).ToList(), ct);

    public Task<NetworkSummaryResponse> GetNetworkSummaryAsync(Actor actor, CancellationToken ct) => store.ReadAsync(db =>
    {
        var customerAccount = actor.Role == NimsRoles.Customer
            ? db.Customers.FirstOrDefault(x => x.Id == actor.Id && x.Status == "Active")
            : null;
        if (actor.Role == NimsRoles.Customer && customerAccount is null)
            throw new ApiException(404, "Customer account not found.");

        var routers = actor.Role == NimsRoles.Customer
            ? db.Routers.Where(x => x.Id == customerAccount!.RouterId).ToList()
            : db.Routers.OrderBy(x => x.Id).ToList();
        var towerIds = routers.Select(x => x.TowerId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var towers = db.Towers.Where(x => towerIds.Contains(x.Id)).OrderBy(x => x.Name).ToList();
        var routerIds = routers.Select(x => x.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var customers = actor.Role switch
        {
            NimsRoles.Admin => db.Customers.OrderBy(x => x.Name)
                .Select(x => new NetworkCustomerSummary(x.Id, x.Name, x.RouterId, x.Status, x.Email, x.Phone, x.Address)).ToList(),
            NimsRoles.Customer => [new NetworkCustomerSummary(customerAccount!.Id, customerAccount.Name, customerAccount.RouterId,
                customerAccount.Status, customerAccount.Email, customerAccount.Phone, customerAccount.Address)],
            _ => db.Customers.Where(x => routerIds.Contains(x.RouterId)).OrderBy(x => x.Name)
                .Select(x => new NetworkCustomerSummary(x.Id, x.Name, x.RouterId, x.Status)).ToList()
        };

        var engineers = actor.Role is NimsRoles.Admin or NimsRoles.Lead
            ? db.Users.Where(x => x.Role == NimsRoles.Engineer).OrderBy(x => x.Name)
                .Select(x => new NetworkEngineerSummary(x.Id, x.Name, x.Status)).ToList()
            : [];

        return new NetworkSummaryResponse(towers, routers, customers, engineers);
    }, ct);

    public Task<IReadOnlyList<UserSummary>> GetUsersAsync(CancellationToken ct) => store.ReadAsync(db =>
        (IReadOnlyList<UserSummary>)db.Users.OrderBy(x => x.Name).Select(x => AuthService.ToSummary(x.Id, x.Name, x.Email, x.Role, x.Status)).ToList(), ct);

    public Task<IReadOnlyList<object>> GetCustomersAsync(Actor actor, CancellationToken ct) => store.ReadAsync(db =>
    {
        var customers = db.Customers.AsEnumerable();
        if (actor.Role == NimsRoles.Customer) customers = customers.Where(x => x.Id == actor.Id);
        return (IReadOnlyList<object>)customers.OrderBy(x => x.Name).Select(CustomerView).Cast<object>().ToList();
    }, ct);

    public Task<Tower> CreateTowerAsync(TowerWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var tower = new Tower { Id = NewId(db.Towers.Select(x => x.Id), "TWR"), Name = request.Name.Trim(), Location = request.Location.Trim(), Status = ValidAssetStatus(request.Status) };
        db.Towers.Add(tower); Log(db, actor, $"Created tower {tower.Id}"); return tower;
    }, ct);

    public Task<Tower> UpdateTowerAsync(string id, TowerWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var tower = Find(db.Towers, id, "Tower");
        tower.Name = request.Name.Trim(); tower.Location = request.Location.Trim(); tower.Status = ValidAssetStatus(request.Status);
        Log(db, actor, $"Updated tower {id}"); return tower;
    }, ct);

    public Task DeleteTowerAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var tower = Find(db.Towers, id, "Tower"); tower.Status = "Deactivated"; Log(db, actor, $"Deactivated tower {id}"); return true;
    }, ct);

    public Task<Router> CreateRouterAsync(RouterWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (db.Routers.Any(x => x.Id.Equals(request.Id, StringComparison.OrdinalIgnoreCase))) throw new ApiException(409, "A router with this ID already exists.");
        Find(db.Towers, request.TowerId, "Tower");
        var router = new Router { Id = request.Id.Trim(), TowerId = request.TowerId, Model = request.Model.Trim(), Status = ValidAssetStatus(request.Status) };
        db.Routers.Add(router); Log(db, actor, $"Created router {router.Id}"); return router;
    }, ct);

    public Task<Router> UpdateRouterAsync(string id, RouterWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var router = Find(db.Routers, id, "Router");
        if (!id.Equals(request.Id, StringComparison.OrdinalIgnoreCase) && db.Routers.Any(x => x.Id.Equals(request.Id, StringComparison.OrdinalIgnoreCase))) throw new ApiException(409, "A router with this ID already exists.");
        Find(db.Towers, request.TowerId, "Tower");
        router.Id = request.Id.Trim(); router.TowerId = request.TowerId; router.Model = request.Model.Trim(); router.Status = ValidAssetStatus(request.Status);
        foreach (var customer in db.Customers.Where(x => x.RouterId.Equals(id, StringComparison.OrdinalIgnoreCase))) customer.RouterId = router.Id;
        foreach (var incident in db.Incidents.Where(x => x.RouterId.Equals(id, StringComparison.OrdinalIgnoreCase))) incident.RouterId = router.Id;
        Log(db, actor, $"Updated router {router.Id}"); return router;
    }, ct);

    public Task DeleteRouterAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var router = Find(db.Routers, id, "Router"); router.Status = "Deactivated"; Log(db, actor, $"Deactivated router {id}"); return true;
    }, ct);

    public Task<IReadOnlyList<UserSummary>> GetUsersSafeAsync(CancellationToken ct) => GetUsersAsync(ct);

    public Task<UserSummary> CreateUserAsync(UserWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        ValidateRole(request.Role); ValidateStatus(request.Status);
        if (string.IsNullOrWhiteSpace(request.Password)) throw new ApiException(400, "A password is required for a new user.");
        EnsureEmailUnique(db, request.Email, null);
        var user = new User { Id = Guid.NewGuid().ToString("N"), Name = request.Name.Trim(), Email = request.Email.Trim(), PasswordHash = Security.PasswordHasher.Hash(request.Password), Role = request.Role, Status = request.Status };
        db.Users.Add(user); Log(db, actor, $"Created {user.Role} user {user.Name}"); return AuthService.ToSummary(user.Id, user.Name, user.Email, user.Role, user.Status);
    }, ct);

    public Task<UserSummary> UpdateUserAsync(string id, UserWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        ValidateRole(request.Role); ValidateStatus(request.Status);
        var user = Find(db.Users, id, "User"); EnsureEmailUnique(db, request.Email, id);
        user.Name = request.Name.Trim(); user.Email = request.Email.Trim(); user.Role = request.Role; user.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.Password)) user.PasswordHash = Security.PasswordHasher.Hash(request.Password);
        Log(db, actor, $"Updated user {user.Name}"); return AuthService.ToSummary(user.Id, user.Name, user.Email, user.Role, user.Status);
    }, ct);

    public Task DeleteUserAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var user = Find(db.Users, id, "User"); user.Status = "Inactive"; Log(db, actor, $"Deactivated user {user.Name}"); return true;
    }, ct);

    public Task<object> CreateCustomerAsync(CustomerWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (string.IsNullOrWhiteSpace(request.Password)) throw new ApiException(400, "A password is required for a new customer account.");
        ValidateStatus(request.Status); Find(db.Routers, request.RouterId, "Router"); EnsureEmailUnique(db, request.Email, null);
        var customer = new Customer { Id = NewId(db.Customers.Select(x => x.Id), "CUS"), Name = request.Name.Trim(), Email = request.Email.Trim(), PasswordHash = Security.PasswordHasher.Hash(request.Password), Phone = request.Phone.Trim(), Address = request.Address.Trim(), RouterId = request.RouterId, Status = request.Status };
        db.Customers.Add(customer); Log(db, actor, $"Created customer {customer.Name}"); return CustomerView(customer);
    }, ct);

    public Task<object> UpdateCustomerAsync(string id, CustomerWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var customer = Find(db.Customers, id, "Customer"); ValidateStatus(request.Status); Find(db.Routers, request.RouterId, "Router"); EnsureEmailUnique(db, request.Email, id);
        customer.Name = request.Name.Trim(); customer.Email = request.Email.Trim(); customer.Phone = request.Phone.Trim(); customer.Address = request.Address.Trim(); customer.RouterId = request.RouterId; customer.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.Password)) customer.PasswordHash = Security.PasswordHasher.Hash(request.Password);
        Log(db, actor, $"Updated customer {customer.Name}"); return CustomerView(customer);
    }, ct);

    public Task<SlaPolicy> CreatePolicyAsync(SlaPolicyWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (db.Policies.Any(x => x.Id == request.Id)) throw new ApiException(409, "An SLA policy with this priority already exists.");
        var policy = ToPolicy(request); ValidatePolicy(db.Policies, policy, null); db.Policies.Add(policy); db.Policies = db.Policies.OrderBy(x => x.Min).ToList();
        Log(db, actor, $"Created SLA policy {policy.Id}"); return policy;
    }, ct);

    public Task<SlaPolicy> UpdatePolicyAsync(string id, SlaPolicyWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var policy = Find(db.Policies, id, "SLA policy");
        if (id != request.Id && db.Policies.Any(x => x.Id == request.Id)) throw new ApiException(409, "An SLA policy with this priority already exists.");
        var next = ToPolicy(request); ValidatePolicy(db.Policies, next, id); policy.Id = next.Id; policy.Range = next.Range; policy.Min = next.Min; policy.Max = next.Max; policy.Response = next.Response; policy.Resolution = next.Resolution;
        db.Policies = db.Policies.OrderBy(x => x.Min).ToList(); Log(db, actor, $"Updated SLA policy {policy.Id}"); return policy;
    }, ct);

    public Task<IReadOnlyList<Incident>> GetIncidentsAsync(Actor actor, string? status, string? priority, string? category, string? search, CancellationToken ct) => store.ReadAsync(db =>
    {
        IEnumerable<Incident> query = db.Incidents.Where(x => CanViewIncident(db, x, actor));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status.Equals(status, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(priority)) query = query.Where(x => x.Priority.Equals(priority, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(x => x.Category.Equals(category, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => $"{x.Id} {x.Title} {x.Assignee}".Contains(search, StringComparison.OrdinalIgnoreCase));
        return (IReadOnlyList<Incident>)query.OrderByDescending(x => x.CreatedAt).ToList();
    }, ct);

    public Task<Incident> GetIncidentAsync(string id, Actor actor, CancellationToken ct) => store.ReadAsync(db =>
    {
        var incident = Find(db.Incidents, id, "Incident"); if (!CanViewIncident(db, incident, actor)) throw new ApiException(404, "Incident not found."); return incident;
    }, ct);

    public Task<IncidentCreateResponse> CreateIncidentAsync(IncidentCreateRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (actor.Role == NimsRoles.Customer && !db.Customers.Any(c => c.Id == actor.Id && c.Status == "Active" && c.RouterId == request.RouterId))
            throw new ApiException(403, "Customers can only raise incidents for their mapped router.");
        var router = Find(db.Routers, request.RouterId, "Router");
        var tower = Find(db.Towers, request.TowerId, "Tower");
        if (router.TowerId != tower.Id) throw new ApiException(400, "The selected router does not belong to the selected tower.");
        if (tower.Status != "Active" || router.Status != "Active") throw new ApiException(400, "Incidents can only be raised against active network assets.");
        var count = request.Scope == "tower" ? db.Customers.Count(c => db.Routers.Any(r => r.TowerId == tower.Id && r.Id == c.RouterId && c.Status == "Active")) : db.Customers.Count(c => c.RouterId == router.Id && c.Status == "Active");
        var policy = db.Policies.OrderBy(p => p.Min).FirstOrDefault(p => count >= p.Min && count <= p.Max) ?? db.Policies.OrderBy(p => p.Min).First();
        var created = DateTimeOffset.UtcNow;
        var operatorName = db.Users.FirstOrDefault(u => u.Role == NimsRoles.Operator && u.Status == "Active")?.Name ?? "Unassigned";
        var incident = new Incident
        {
            Id = NewId(db.Incidents.Select(x => x.Id), "INC"), Title = request.Title.Trim(), Description = request.Description.Trim(), Category = request.Category,
            Scope = request.Scope, RouterId = router.Id, TowerId = tower.Id, Affected = count, Priority = policy.Id, Status = "Open", Assignee = operatorName,
            CreatedAt = created, ResponseDeadline = created.AddHours(policy.Response), ResolutionDeadline = created.AddHours(policy.Resolution)
        };
        AddTimeline(incident, $"Incident created · {policy.Id} SLA allocated", actor.Name);
        incident.Notes.Add(new() { Text = "Incident created and SLA allocated automatically.", Author = actor.Name, At = created });
        db.Incidents.Insert(0, incident); Log(db, actor, $"Created incident {incident.Id} with {policy.Id} SLA");
        Notify(db, "New incident created", $"{incident.Id} is available in the operator queue.", NimsRoles.Operator);
        return new IncidentCreateResponse(incident, policy);
    }, ct);

    public Task<Incident> AddNoteAsync(string id, NoteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var incident = GetVisibleIncident(db, id, actor); if (incident.Status == "Resolved") throw new ApiException(409, "Resolved incidents cannot receive new notes.");
        incident.Notes.Add(new() { Text = request.Text.Trim(), Author = actor.Name, At = DateTimeOffset.UtcNow }); AddTimeline(incident, "Troubleshooting note added", actor.Name); Log(db, actor, $"Added note to {id}"); return incident;
    }, ct);

    public Task<Incident> EscalateAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var incident = GetVisibleIncident(db, id, actor);
        if (actor.Role != NimsRoles.Operator) throw new ApiException(403, "Only an assigned operator can escalate an incident.");
        if (incident.Status == "Resolved") throw new ApiException(409, "Resolved incidents cannot be escalated.");
        incident.Status = "Escalated"; incident.Escalated = true; AddTimeline(incident, "Escalated to Technical Lead", actor.Name); Log(db, actor, $"Escalated {id}");
        Notify(db, "Incident escalated", $"{id} needs technical lead review.", NimsRoles.Lead); return incident;
    }, ct);

    public Task<Incident> ValidateIncidentAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (actor.Role is not (NimsRoles.Lead or NimsRoles.Admin)) throw new ApiException(403, "Only a technical lead or admin can validate incidents.");
        var incident = Find(db.Incidents, id, "Incident");
        if (!incident.Escalated && incident.Status != "Escalated") throw new ApiException(409, "Only escalated incidents can be technically validated.");
        incident.Status = "Pending validation"; incident.Escalated = true;
        AddTimeline(incident, "Technical validation completed", actor.Name); Log(db, actor, $"Validated {id}"); return incident;
    }, ct);

    public Task<Incident> ResolveIncidentAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var incident = GetVisibleIncident(db, id, actor);
        if (actor.Role is not (NimsRoles.Operator or NimsRoles.Lead or NimsRoles.Admin)) throw new ApiException(403, "This role cannot resolve incidents.");
        if (actor.Role == NimsRoles.Operator && (incident.Assignee != actor.Name || incident.Escalated)) throw new ApiException(403, "Only the assigned operator can resolve a non-escalated incident.");
        incident.Status = "Resolved"; AddTimeline(incident, "Incident resolved and closed", actor.Name); Log(db, actor, $"Closed {id}"); return incident;
    }, ct);

    public Task<IReadOnlyList<FieldTask>> GetFieldTasksAsync(Actor actor, CancellationToken ct) => store.ReadAsync(db =>
    {
        IEnumerable<FieldTask> tasks = db.FieldTasks;
        if (actor.Role == NimsRoles.Engineer) tasks = tasks.Where(x => x.Engineer == actor.Name);
        if (actor.Role == NimsRoles.Customer || actor.Role == NimsRoles.Operator) tasks = [];
        return (IReadOnlyList<FieldTask>)tasks.OrderBy(x => x.Status == "Completed").ThenBy(x => x.Id).ToList();
    }, ct);

    public Task<FieldTask> AssignFieldTaskAsync(FieldTaskWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (actor.Role is not (NimsRoles.Lead or NimsRoles.Admin)) throw new ApiException(403, "Only a technical lead or admin can assign field work.");
        var incident = Find(db.Incidents, request.IncidentId, "Incident"); if (incident.Status == "Resolved") throw new ApiException(409, "Resolved incidents cannot receive field assignments.");
        var engineer = Find(db.Users, u => u.Name == request.Engineer && u.Role == NimsRoles.Engineer && u.Status == "Active", "Active field engineer");
        var task = db.FieldTasks.FirstOrDefault(x => x.IncidentId == incident.Id);
        if (task is null)
        {
            task = new FieldTask { Id = NewId(db.FieldTasks.Select(x => x.Id), "FS"), IncidentId = incident.Id, Engineer = engineer.Name, Status = "Scheduled", Location = db.Towers.FirstOrDefault(x => x.Id == incident.TowerId)?.Location ?? "Network site", Instructions = request.Instructions.Trim() };
            db.FieldTasks.Add(task); incident.FieldRequired = true; AddTimeline(incident, "Field-service request created", actor.Name); Log(db, actor, $"Created field request for {incident.Id}");
        }
        else
        {
            task.Engineer = engineer.Name; task.Instructions = request.Instructions.Trim(); AddTimeline(incident, "Field engineer assignment updated", actor.Name); Log(db, actor, $"Updated field assignment for {incident.Id}");
        }
        Notify(db, "Field work assigned", $"{task.Id} has been assigned to you.", NimsRoles.Engineer, engineer.Id); return task;
    }, ct);

    public Task<FieldTask> SubmitFieldReportAsync(string id, FieldReportRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (actor.Role != NimsRoles.Engineer) throw new ApiException(403, "Only field engineers can submit repair reports.");
        var task = Find(db.FieldTasks, id, "Field task"); if (task.Engineer != actor.Name) throw new ApiException(403, "This task is assigned to another engineer.");
        if (request.Status is not ("In progress" or "Report submitted")) throw new ApiException(400, "Report status must be In progress or Report submitted.");
        task.Status = request.Status; task.Report = request.Report.Trim(); task.Diagnosis = request.Diagnosis.Trim();
        var incident = Find(db.Incidents, task.IncidentId, "Incident"); AddTimeline(incident, "Field engineer report submitted", actor.Name); Log(db, actor, $"Submitted report for {id}");
        Notify(db, "Field report submitted", $"{id} is ready for verification.", NimsRoles.Lead); return task;
    }, ct);

    public Task<FieldTask> VerifyFieldTaskAsync(string id, bool approve, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        if (actor.Role is not (NimsRoles.Lead or NimsRoles.Admin)) throw new ApiException(403, "Only a technical lead or admin can verify field reports.");
        var task = Find(db.FieldTasks, id, "Field task"); if (task.Status != "Report submitted") throw new ApiException(409, "The field report has not been submitted.");
        task.Status = approve ? "Completed" : "Rejected"; var incident = Find(db.Incidents, task.IncidentId, "Incident");
        AddTimeline(incident, approve ? "Field report verified" : "Field report rejected", actor.Name); Log(db, actor, $"{(approve ? "Verified" : "Rejected")} report {id}");
        Notify(db, approve ? "Field work completed" : "Field report needs changes", $"{id} was {(approve ? "verified" : "rejected")}. ", NimsRoles.Engineer, db.Users.FirstOrDefault(x => x.Role == NimsRoles.Engineer && x.Name == task.Engineer)?.Id);
        return task;
    }, ct);

    public Task<IReadOnlyList<Notification>> GetNotificationsAsync(Actor actor, CancellationToken ct) => store.ReadAsync(db =>
        (IReadOnlyList<Notification>)db.Notifications.Where(x => (x.UserId is null || x.UserId == actor.Id) && (x.Role is null || x.Role == actor.Role)).OrderByDescending(x => x.At).ToList(), ct);

    public Task MarkNotificationReadAsync(string id, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var notification = Find(db.Notifications, id, "Notification");
        if (notification.UserId is not null && notification.UserId != actor.Id || notification.Role is not null && notification.Role != actor.Role) throw new ApiException(404, "Notification not found.");
        notification.Read = true; return true;
    }, ct);

    public Task<IReadOnlyList<AuditEntry>> GetAuditAsync(CancellationToken ct) => store.ReadAsync(db => (IReadOnlyList<AuditEntry>)db.Audit.OrderByDescending(x => x.At).Take(500).ToList(), ct);

    public Task<ReportsResponse> GetReportsAsync(CancellationToken ct) => store.ReadAsync(db =>
    {
        var incidents = db.Incidents;
        return new ReportsResponse(incidents.Count, incidents.Count(x => x.Status != "Resolved"), incidents.Count(x => x.Status == "Resolved"),
            incidents.Count(x => x.Status != "Resolved" && x.ResolutionDeadline < DateTimeOffset.UtcNow),
            incidents.GroupBy(x => x.Category).ToDictionary(x => x.Key, x => x.Count()), incidents.GroupBy(x => x.Priority).ToDictionary(x => x.Key, x => x.Count()));
    }, ct);

    public Task<string> ExportIncidentsCsvAsync(CancellationToken ct) => store.ReadAsync(db =>
    {
        static string Csv(string value) => $"\"{value.Replace("\"", "\"\"")}\"";
        return string.Join("\r\n", new[] { "Incident,Title,Priority,Status,Affected customers" }.Concat(db.Incidents.OrderByDescending(x => x.CreatedAt).Select(x =>
            $"{Csv(x.Id)},{Csv(x.Title)},{Csv(x.Priority)},{Csv(x.Status)},{x.Affected}")));
    }, ct);

    public Task<UserSettings> GetSettingsAsync(Actor actor, CancellationToken ct) => store.ReadAsync(db => db.Settings.TryGetValue(actor.Id, out var settings) ? settings : new UserSettings(), ct);

    public Task<UserSettings> SaveSettingsAsync(SettingsWriteRequest request, Actor actor, CancellationToken ct) => store.UpdateAsync(db =>
    {
        var settings = new UserSettings { SlaWarnings = request.SlaWarnings, FieldUpdates = request.FieldUpdates, CompactTables = request.CompactTables, Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? "Asia/Kolkata" : request.Timezone.Trim() };
        db.Settings[actor.Id] = settings; Log(db, actor, "Updated workspace settings"); return settings;
    }, ct);

    public Task<DashboardResponse> GetDashboardAsync(Actor actor, CancellationToken ct) => store.ReadAsync(db =>
    {
        var incidents = db.Incidents.Where(x => CanViewIncident(db, x, actor)).OrderByDescending(x => x.CreatedAt).ToList();
        var tasks = actor.Role == NimsRoles.Engineer ? db.FieldTasks.Where(x => x.Engineer == actor.Name).ToList() : actor.Role is NimsRoles.Lead or NimsRoles.Admin ? db.FieldTasks.ToList() : [];
        var stats = new Dictionary<string, object>();
        switch (actor.Role)
        {
            case NimsRoles.Admin:
                stats["towers"] = db.Towers.Count; stats["routers"] = db.Routers.Count; stats["customers"] = db.Customers.Count;
                stats["activeIncidents"] = db.Incidents.Count(x => x.Status != "Resolved"); stats["slaBreaches"] = db.Incidents.Count(x => x.Status != "Resolved" && x.ResolutionDeadline < DateTimeOffset.UtcNow); break;
            case NimsRoles.Operator:
                stats["assignedIncidents"] = incidents.Count(x => x.Status != "Resolved"); stats["escalated"] = incidents.Count(x => x.Escalated); stats["slaAttention"] = incidents.Count(x => x.Status != "Resolved" && x.ResolutionDeadline < DateTimeOffset.UtcNow); break;
            case NimsRoles.Lead:
                stats["escalatedIncidents"] = incidents.Count(x => x.Escalated); stats["pendingValidation"] = incidents.Count(x => x.Status == "Pending validation"); stats["openFieldRequests"] = tasks.Count(x => x.Status != "Completed"); break;
            case NimsRoles.Engineer:
                stats["assignedTasks"] = tasks.Count; stats["scheduled"] = tasks.Count(x => x.Status == "Scheduled"); stats["inProgress"] = tasks.Count(x => x.Status == "In progress"); stats["completed"] = tasks.Count(x => x.Status == "Completed"); break;
            case NimsRoles.Customer:
                stats["activeIncidents"] = incidents.Count(x => x.Status != "Resolved"); stats["resolvedIncidents"] = incidents.Count(x => x.Status == "Resolved"); break;
        }
        return new DashboardResponse(actor.Role, stats, incidents.Take(10).ToList(), tasks);
    }, ct);

    private static bool CanViewIncident(NimsDatabase db, Incident incident, Actor actor) => actor.Role switch
    {
        NimsRoles.Admin => true,
        NimsRoles.Operator => incident.Assignee == actor.Name,
        NimsRoles.Lead => incident.Escalated || incident.Status is "Escalated" or "Pending validation",
        NimsRoles.Customer => db.Customers.Any(c => c.Id == actor.Id && c.Status == "Active" && c.RouterId == incident.RouterId),
        _ => false
    };

    private static Incident GetVisibleIncident(NimsDatabase db, string id, Actor actor)
    {
        var item = Find(db.Incidents, id, "Incident");
        if (!CanViewIncident(db, item, actor)) throw new ApiException(404, "Incident not found.");
        return item;
    }

    private static T Find<T>(IEnumerable<T> items, string id, string name) where T : class
    {
        var prop = typeof(T).GetProperty("Id")!;
        return items.FirstOrDefault(x => string.Equals((string?)prop.GetValue(x), id, StringComparison.OrdinalIgnoreCase)) ?? throw new ApiException(404, $"{name} not found.");
    }

    private static T Find<T>(IEnumerable<T> items, Func<T, bool> predicate, string name) => items.FirstOrDefault(predicate) ?? throw new ApiException(404, $"{name} not found.");
    private static object CustomerView(Customer c) => new { c.Id, c.Name, c.Email, c.Phone, c.Address, c.RouterId, c.Status };
    private static string ValidAssetStatus(string value) => value is "Active" or "Deactivated" ? value : throw new ApiException(400, "Status must be Active or Deactivated.");
    private static void ValidateStatus(string status) { if (!Statuses.Contains(status)) throw new ApiException(400, "Status must be Active or Inactive."); }
    private static void ValidateRole(string role) { if (!Roles.Contains(role)) throw new ApiException(400, "Role must be admin, operator, lead, engineer, or customer."); }
    private static void EnsureEmailUnique(NimsDatabase db, string email, string? exceptId)
    {
        if (db.Users.Any(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase) && x.Id != exceptId) || db.Customers.Any(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase) && x.Id != exceptId)) throw new ApiException(409, "An account with this email already exists.");
    }
    private static void ValidatePolicy(IEnumerable<SlaPolicy> policies, SlaPolicy candidate, string? exceptId)
    {
        if (candidate.Min > candidate.Max) throw new ApiException(400, "Policy minimum must be less than or equal to its maximum.");
        if (candidate.Response >= candidate.Resolution) throw new ApiException(400, "Response time must be shorter than resolution time.");
        if (policies.Any(p => p.Id != exceptId && candidate.Min <= p.Max && candidate.Max >= p.Min)) throw new ApiException(409, "SLA customer ranges cannot overlap.");
    }
    private static SlaPolicy ToPolicy(SlaPolicyWriteRequest x) => new() { Id = x.Id, Range = x.Range.Trim(), Min = x.Min, Max = x.Max, Response = x.Response, Resolution = x.Resolution };
    private static string NewId(IEnumerable<string> ids, string prefix)
    {
        var known = ids.ToHashSet(StringComparer.OrdinalIgnoreCase);
        string candidate; do { candidate = $"{prefix}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds():X}"; } while (known.Contains(candidate)); return candidate;
    }
    private static void AddTimeline(Incident incident, string title, string actor) => incident.Timeline.Add(new() { Title = title, Actor = actor, At = DateTimeOffset.UtcNow });
    private static void Log(NimsDatabase db, Actor actor, string title) => db.Audit.Insert(0, new() { Title = title, Actor = actor.Name });
    private static void Notify(NimsDatabase db, string title, string detail, string? role = null, string? userId = null) => db.Notifications.Insert(0, new() { Title = title, Detail = detail, Role = role, UserId = userId });
}
