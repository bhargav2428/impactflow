namespace Nims.Api;

public static class OpenApiDocumentFactory
{
    public const string SwaggerUi = """
        <!doctype html><html><head><meta charset="utf-8"><title>NIMS API · Swagger</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
        <body><div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script>window.onload=()=>SwaggerUIBundle({url:'/swagger/v1/swagger.json',dom_id:'#swagger-ui',deepLinking:true,displayRequestDuration:true});</script>
        </body></html>
        """;

    public static object Create()
    {
        var paths = new Dictionary<string, object>();
        void Add(string path, string method, string summary, string tag, string? request = null, string response = "object", bool auth = true, bool pathId = false, string? query = null, int success = 200, string contentType = "application/json")
        {
            var operation = new Dictionary<string, object>
            {
                ["operationId"] = OperationId(method, path), ["summary"] = summary, ["tags"] = new[] { tag },
                ["responses"] = ResponseMap(success, response, contentType)
            };
            if (auth) operation["security"] = new[] { new Dictionary<string, string[]> { ["bearerAuth"] = [] } };
            if (pathId) operation["parameters"] = new object[] { new { name = "id", @in = "path", required = true, schema = new { type = "string" } } };
            if (query is not null) operation["parameters"] = query.Split(',').Select(x => new { name = x, @in = "query", required = false, schema = new { type = "string" } }).Cast<object>().ToArray();
            if (request is not null) operation["requestBody"] = new { required = true, content = new Dictionary<string, object> { ["application/json"] = new { schema = new Dictionary<string, string> { ["$ref"] = $"#/components/schemas/{request}" } } } };
            if (!paths.TryGetValue(path, out var existing)) paths[path] = existing = new Dictionary<string, object>();
            ((Dictionary<string, object>)existing)[method.ToLowerInvariant()] = operation;
        }

        Add("/api/health", "GET", "API health check", "System", response: "Health", auth: false);
        Add("/api/auth/login", "POST", "Sign in and receive a bearer token", "Authentication", "LoginRequest", "LoginResponse", auth: false);
        Add("/api/auth/me", "GET", "Get the current signed-in account", "Authentication", response: "AuthResponse");
        Add("/api/auth/logout", "POST", "Sign out the current session", "Authentication", response: "object", success: 204);
        Add("/api/dashboard", "GET", "Get role-scoped dashboard statistics and queues", "Dashboard", response: "DashboardResponse");
        Add("/api/network/summary", "GET", "Get role-appropriate network and customer summaries", "Network", response: "NetworkSummaryResponse");
        Add("/api/towers", "GET", "List network towers", "Infrastructure", response: "Tower[]");
        Add("/api/towers", "POST", "Create a tower", "Infrastructure", "TowerWriteRequest", "Tower");
        Add("/api/towers/{id}", "PUT", "Update a tower", "Infrastructure", "TowerWriteRequest", "Tower", pathId: true);
        Add("/api/towers/{id}", "DELETE", "Deactivate a tower", "Infrastructure", pathId: true, success: 204);
        Add("/api/routers", "GET", "List routers", "Infrastructure", response: "Router[]");
        Add("/api/routers", "POST", "Create a router", "Infrastructure", "RouterWriteRequest", "Router");
        Add("/api/routers/{id}", "PUT", "Update a router", "Infrastructure", "RouterWriteRequest", "Router", pathId: true);
        Add("/api/routers/{id}", "DELETE", "Deactivate a router", "Infrastructure", pathId: true, success: 204);
        Add("/api/users", "GET", "List account users", "Users", response: "UserSummary[]");
        Add("/api/users", "POST", "Create an employee account", "Users", "UserWriteRequest", "UserSummary");
        Add("/api/users/{id}", "PUT", "Update an employee account", "Users", "UserWriteRequest", "UserSummary", pathId: true);
        Add("/api/users/{id}", "DELETE", "Deactivate an employee account", "Users", pathId: true, success: 204);
        Add("/api/customers", "GET", "List customers or the current customer's own account", "Customers", response: "Customer[]");
        Add("/api/customers", "POST", "Create a customer account", "Customers", "CustomerWriteRequest", "Customer");
        Add("/api/customers/{id}", "PUT", "Update a customer account", "Customers", "CustomerWriteRequest", "Customer", pathId: true);
        Add("/api/sla-policies", "GET", "List SLA policies", "SLA", response: "SlaPolicy[]");
        Add("/api/sla-policies", "POST", "Create an SLA policy", "SLA", "SlaPolicyWriteRequest", "SlaPolicy");
        Add("/api/sla-policies/{id}", "PUT", "Update an SLA policy", "SLA", "SlaPolicyWriteRequest", "SlaPolicy", pathId: true);
        Add("/api/incidents", "GET", "List incidents visible to the current role", "Incidents", response: "Incident[]", query: "status,priority,category,search");
        Add("/api/incidents", "POST", "Customer creates an incident and receives its SLA allocation", "Incidents", "IncidentCreateRequest", "IncidentCreateResponse");
        Add("/api/incidents/{id}", "GET", "Get an incident and its timeline", "Incidents", response: "Incident", pathId: true);
        Add("/api/incidents/{id}/notes", "POST", "Add an incident note", "Incidents", "NoteRequest", "Incident", pathId: true);
        Add("/api/incidents/{id}/escalate", "POST", "Escalate an assigned incident", "Incidents", response: "Incident", pathId: true);
        Add("/api/incidents/{id}/validate", "POST", "Record technical validation", "Incidents", response: "Incident", pathId: true);
        Add("/api/incidents/{id}/resolve", "POST", "Resolve an incident", "Incidents", response: "Incident", pathId: true);
        Add("/api/field-tasks", "GET", "List field tasks visible to the current role", "Field Service", response: "FieldTask[]");
        Add("/api/field-tasks", "POST", "Create or update a field engineer assignment", "Field Service", "FieldTaskWriteRequest", "FieldTask");
        Add("/api/field-tasks/{id}/report", "PUT", "Submit a field visit report", "Field Service", "FieldReportRequest", "FieldTask", pathId: true);
        Add("/api/field-tasks/{id}/verify", "POST", "Verify a submitted field report", "Field Service", response: "FieldTask", pathId: true);
        Add("/api/field-tasks/{id}/reject", "POST", "Reject a submitted field report", "Field Service", response: "FieldTask", pathId: true);
        Add("/api/notifications", "GET", "List notifications for the current account and role", "Notifications", response: "Notification[]");
        Add("/api/notifications/{id}/read", "PATCH", "Mark a notification as read", "Notifications", pathId: true, success: 204);
        Add("/api/audit", "GET", "List recent administrative and workflow events", "Audit", response: "AuditEntry");
        Add("/api/reports", "GET", "Get incident and SLA analytics", "Reports", response: "ReportsResponse");
        Add("/api/reports/incidents.csv", "GET", "Download incidents as CSV", "Reports", response: "csv", contentType: "text/csv");
        Add("/api/settings", "GET", "Get the current account's settings", "Settings", response: "UserSettings");
        Add("/api/settings", "PUT", "Save the current account's settings", "Settings", "SettingsWriteRequest", "UserSettings");

        return new
        {
            openapi = "3.0.3",
            info = new { title = "NIMS Network Incident Management API", version = "v1", description = "Role-aware API for network incidents, infrastructure, SLAs, field service, users, and customers." },
            tags = new[] { "System", "Authentication", "Dashboard", "Network", "Infrastructure", "Users", "Customers", "SLA", "Incidents", "Field Service", "Notifications", "Audit", "Reports", "Settings" }.Select(x => new { name = x }),
            paths,
            components = new
            {
                securitySchemes = new { bearerAuth = new { type = "http", scheme = "bearer", bearerFormat = "JWT" } },
                schemas = new Dictionary<string, object>
                {
                    ["LoginRequest"] = ObjectSchema(("email", "string"), ("password", "string")), ["LoginResponse"] = ObjectSchema(("accessToken", "string"), ("expiresAt", "string"), ("user", "object")),
                    ["AuthResponse"] = ObjectSchema(("user", "object")), ["UserSummary"] = ObjectSchema(("id", "string"), ("name", "string"), ("email", "string"), ("role", "string"), ("label", "string"), ("initials", "string"), ("status", "string")),
                    ["UserWriteRequest"] = ObjectSchema(("name", "string"), ("email", "string"), ("password", "string"), ("role", "string"), ("status", "string")),
                    ["CustomerWriteRequest"] = ObjectSchema(("name", "string"), ("email", "string"), ("password", "string"), ("phone", "string"), ("address", "string"), ("routerId", "string"), ("status", "string")),
                    ["Customer"] = ObjectSchema(("id", "string"), ("name", "string"), ("email", "string"), ("phone", "string"), ("address", "string"), ("routerId", "string"), ("status", "string")),
                    ["TowerWriteRequest"] = ObjectSchema(("name", "string"), ("location", "string"), ("status", "string")), ["Tower"] = ObjectSchema(("id", "string"), ("name", "string"), ("location", "string"), ("status", "string")),
                    ["RouterWriteRequest"] = ObjectSchema(("id", "string"), ("towerId", "string"), ("model", "string"), ("status", "string")), ["Router"] = ObjectSchema(("id", "string"), ("towerId", "string"), ("model", "string"), ("status", "string")),
                    ["SlaPolicyWriteRequest"] = ObjectSchema(("id", "string"), ("range", "string"), ("min", "integer"), ("max", "integer"), ("response", "number"), ("resolution", "number")), ["SlaPolicy"] = ObjectSchema(("id", "string"), ("range", "string"), ("min", "integer"), ("max", "integer"), ("response", "number"), ("resolution", "number")),
                    ["IncidentCreateRequest"] = ObjectSchema(("title", "string"), ("description", "string"), ("category", "string"), ("scope", "string"), ("routerId", "string"), ("towerId", "string")),
                    ["Incident"] = ObjectSchema(("id", "string"), ("title", "string"), ("description", "string"), ("category", "string"), ("scope", "string"), ("routerId", "string"), ("towerId", "string"), ("affected", "integer"), ("priority", "string"), ("status", "string"), ("assignee", "string"), ("createdAt", "string"), ("responseDeadline", "string"), ("resolutionDeadline", "string"), ("escalated", "boolean"), ("fieldRequired", "boolean"), ("notes", "array"), ("timeline", "array")),
                    ["IncidentCreateResponse"] = ObjectSchema(("incident", "object"), ("policy", "object")), ["NoteRequest"] = ObjectSchema(("text", "string")),
                    ["FieldTaskWriteRequest"] = ObjectSchema(("incidentId", "string"), ("engineer", "string"), ("instructions", "string")), ["FieldReportRequest"] = ObjectSchema(("status", "string"), ("report", "string"), ("diagnosis", "string")),
                    ["FieldTask"] = ObjectSchema(("id", "string"), ("incidentId", "string"), ("engineer", "string"), ("status", "string"), ("location", "string"), ("diagnosis", "string"), ("report", "string"), ("instructions", "string")),
                    ["Notification"] = ObjectSchema(("id", "string"), ("title", "string"), ("detail", "string"), ("read", "boolean"), ("at", "string")), ["AuditEntry"] = ObjectSchema(("id", "string"), ("title", "string"), ("actor", "string"), ("at", "string")),
                    ["SettingsWriteRequest"] = ObjectSchema(("slaWarnings", "boolean"), ("fieldUpdates", "boolean"), ("compactTables", "boolean"), ("timezone", "string")), ["UserSettings"] = ObjectSchema(("slaWarnings", "boolean"), ("fieldUpdates", "boolean"), ("compactTables", "boolean"), ("timezone", "string")),
                    ["DashboardResponse"] = ObjectSchema(("role", "string"), ("stats", "object"), ("incidents", "array"), ("fieldTasks", "array")),
                    ["ReportsResponse"] = ObjectSchema(("totalIncidents", "integer"), ("openIncidents", "integer"), ("resolvedIncidents", "integer"), ("slaBreaches", "integer"), ("byCategory", "object"), ("byPriority", "object")),
                    ["NetworkSummaryResponse"] = ObjectSchema(("towers", "array"), ("routers", "array"), ("customers", "array"), ("engineers", "array")),
                    ["NetworkCustomerSummary"] = ObjectSchema(("id", "string"), ("name", "string"), ("routerId", "string"), ("status", "string"), ("email", "string"), ("phone", "string"), ("address", "string")),
                    ["NetworkEngineerSummary"] = ObjectSchema(("id", "string"), ("name", "string"), ("status", "string")),
                    ["Health"] = ObjectSchema(("status", "string"), ("service", "string"), ("utc", "string"))
                }
            }
        };
    }

    private static object ResponseSchema(string name) => name.EndsWith("[]", StringComparison.Ordinal)
        ? new { type = "array", items = new Dictionary<string, string> { ["$ref"] = $"#/components/schemas/{name[..^2]}" } }
        : name switch
    {
        "csv" => new { type = "string", format = "binary" },
        "object" => new { type = "object", additionalProperties = true },
        _ => new Dictionary<string, string> { ["$ref"] = $"#/components/schemas/{name}" }
    };

    private static Dictionary<string, object> ResponseMap(int success, string response, string contentType)
    {
        var result = new Dictionary<string, object>();
        result[success.ToString()] = success == 204
            ? new Dictionary<string, object> { ["description"] = "No content" }
            : new Dictionary<string, object> { ["description"] = "Success", ["content"] = new Dictionary<string, object> { [contentType] = new { schema = ResponseSchema(response) } } };
        result["400"] = new { description = "Invalid request" };
        result["401"] = new { description = "Missing or invalid bearer token" };
        result["403"] = new { description = "Role or ownership check failed" };
        result["404"] = new { description = "Resource not found" };
        result["409"] = new { description = "Conflict" };
        return result;
    }

    private static object ObjectSchema(params (string Name, string Type)[] properties) => new
    {
        type = "object",
        properties = properties.ToDictionary(p => p.Name, p => PropertySchema(p.Type))
    };

    private static object PropertySchema(string type) => type == "array" ? new { type, items = new { type = "object" } } : new { type };

    private static string OperationId(string method, string path) => method.ToLowerInvariant() + string.Concat(path.Split(new[] { '/', '{', '}', '-' }, StringSplitOptions.RemoveEmptyEntries).Select(x => char.ToUpperInvariant(x[0]) + x[1..]));
}
