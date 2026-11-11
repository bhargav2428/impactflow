param(
    [string]$BaseUrl = "http://127.0.0.1:5090",
    [string]$ReportTaskId = "",
    [string]$DenyReportTaskId = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$http = [System.Net.Http.HttpClient]::new()
$script:Passed = 0

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Token,
        [object]$Body,
        [int]$ExpectedStatus = 200
    )

    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$BaseUrl$Path")
    $request.Headers.ConnectionClose = $true
    if ($Token) { $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token) }
    if ($null -ne $Body) {
        $json = ConvertTo-Json -InputObject $Body -Depth 20 -Compress
        $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, "application/json")
    }
    try { $response = $http.SendAsync($request).GetAwaiter().GetResult() }
    catch { throw "Request send failed for $Method $Path. $($_.Exception.ToString())" }
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $status = [int]$response.StatusCode
    if ($status -ne $ExpectedStatus) {
        throw "$Method $Path expected HTTP $ExpectedStatus, received $status. Body: $text"
    }
    $data = $null
    if ($text) {
        try { $data = ConvertFrom-Json -InputObject $text }
        catch { $data = $text }
    }
    $request.Dispose()
    $response.Dispose()
    return [pscustomobject]@{ Status = $status; Data = $data; Text = $text }
}

function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
    $script:Passed++
    Write-Host "PASS $Message" -ForegroundColor Green
}

function Login([string]$Email, [string]$Password, [string]$Role) {
    $result = Invoke-Api POST "/api/auth/login" "" @{ email = $Email; password = $Password }
    Assert-That ($result.Data.user.role -eq $Role) "$Role demo account can sign in"
    $me = Invoke-Api GET "/api/auth/me" $result.Data.accessToken
    Assert-That ($me.Data.user.id -eq $result.Data.user.id) "$Role /auth/me returns the signed-in account"
    return $result.Data.accessToken
}

function Assert-ReportDenied([string]$TaskId, [string]$Token) {
    $request = [System.Net.HttpWebRequest]::Create("$BaseUrl/api/field-tasks/$TaskId/report")
    $request.Method = "PUT"
    $request.ContentType = "application/json"
    $request.Headers["Authorization"] = "Bearer $Token"
    $payload = ConvertTo-Json -InputObject @{ status = "Report submitted"; diagnosis = "Unauthorized"; report = "Should be denied" } -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Dispose()
    $status = 0
    try { $response = $request.GetResponse() }
    catch [System.Net.WebException] {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw "Wrong-engineer PUT to $TaskId closed the connection without an HTTP response. $($_.Exception.Message)" }
    }
    $status = [int]$response.StatusCode
    $response.Dispose()
    if ($status -ne 403) { throw "Wrong-engineer PUT to $TaskId expected HTTP 403, received $status." }
    $script:Passed++
    Write-Host "PASS another engineer is denied access to field report $TaskId" -ForegroundColor Green
}

Write-Host "NIMS API smoke check: $BaseUrl"
$health = Invoke-Api GET "/api/health" ""
Assert-That ($health.Data.status -eq "ok") "health endpoint responds"

if ($ReportTaskId) {
    $adminToken = Login "admin@nims.test" "Admin@123" "admin"
    $task = (Invoke-Api GET "/api/field-tasks" $adminToken).Data | Where-Object id -eq $ReportTaskId | Select-Object -First 1
    if (-not $task) { throw "Field task $ReportTaskId was not found." }
    $qaUser = (Invoke-Api GET "/api/users" $adminToken).Data | Where-Object name -eq $task.engineer | Select-Object -First 1
    if (-not $qaUser) { throw "No API account found for assigned engineer '$($task.engineer)'." }
    $qaEngineerToken = Login $qaUser.email "QaEngineer@123" "engineer"
    $report = Invoke-Api PUT "/api/field-tasks/$ReportTaskId/report" $qaEngineerToken @{ status = "Report submitted"; diagnosis = "Smoke retry diagnosis"; report = "Smoke retry report" }
    Assert-That ($report.Data.status -eq "Report submitted") "targeted engineer report request succeeds"
    Write-Host "Completed targeted report retry: $ReportTaskId"
    $http.Dispose()
    return
}
if ($DenyReportTaskId) {
    $adminToken = Login "admin@nims.test" "Admin@123" "admin"
    $task = (Invoke-Api GET "/api/field-tasks" $adminToken).Data | Where-Object id -eq $DenyReportTaskId | Select-Object -First 1
    if (-not $task) { throw "Field task $DenyReportTaskId was not found." }
    $baseEngineerToken = Login "engineer@nims.test" "Engineer@123" "engineer"
    Assert-ReportDenied $DenyReportTaskId $baseEngineerToken
    Write-Host "Completed targeted ownership denial check: $DenyReportTaskId"
    $http.Dispose()
    return
}

$admin = Login "admin@nims.test" "Admin@123" "admin"
$operator = Login "operator@nims.test" "Operator@123" "operator"
$lead = Login "lead@nims.test" "Lead@123" "lead"
$engineer = Login "engineer@nims.test" "Engineer@123" "engineer"
$customer = Login "customer@nims.test" "Customer@123" "customer"

Invoke-Api GET "/api/users" "" $null 401 | Out-Null
Invoke-Api GET "/api/users" $lead $null 403 | Out-Null
Invoke-Api POST "/api/towers" $customer @{ name = "Forbidden QA Tower"; location = "Test"; status = "Active" } 403 | Out-Null
Assert-That $true "unauthenticated reads and role-forbidden writes are rejected"

$adminNetwork = (Invoke-Api GET "/api/network/summary" $admin).Data
$leadNetwork = (Invoke-Api GET "/api/network/summary" $lead).Data
$operatorNetwork = (Invoke-Api GET "/api/network/summary" $operator).Data
$customerNetwork = (Invoke-Api GET "/api/network/summary" $customer).Data
Assert-That ($adminNetwork.towers.Count -gt 1 -and $adminNetwork.customers.Count -gt 1) "admin network summary includes full inventory"
Assert-That ($leadNetwork.engineers.Count -gt 0 -and $null -eq $leadNetwork.engineers[0].email) "lead network summary contains safe engineer choices"
Assert-That ($null -eq $leadNetwork.customers[0].email -and $null -eq $operatorNetwork.customers[0].phone) "staff customer summaries omit contact fields"
Assert-That ($customerNetwork.routers.Count -eq 1 -and $customerNetwork.towers.Count -eq 1 -and $customerNetwork.customers.Count -eq 1) "customer network summary is limited to its mapped assets/account"
$ownCustomers = (Invoke-Api GET "/api/customers" $customer).Data
Assert-That ($ownCustomers.Count -eq 1 -and $ownCustomers[0].id -eq $customerNetwork.customers[0].id) "customer account endpoint is scoped to the caller"
$engineerTasks = (Invoke-Api GET "/api/field-tasks" $engineer).Data
Assert-That (@($engineerTasks | Where-Object { $_.engineer -ne "Vikram Singh" }).Count -eq 0) "engineer task list is restricted to assignments"

$suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$tower = (Invoke-Api POST "/api/towers" $admin @{ name = "QA Tower $suffix"; location = "QA Lab"; status = "Active" }).Data
$routerId = "QA_$suffix"
$router = (Invoke-Api POST "/api/routers" $admin @{ id = $routerId; towerId = $tower.id; model = "QA Router"; status = "Active" }).Data
$updatedTower = (Invoke-Api PUT "/api/towers/$($tower.id)" $admin @{ name = $tower.name; location = "QA Lab Updated"; status = "Active" }).Data
Assert-That ($updatedTower.location -eq "QA Lab Updated") "admin tower create/update works"
$policy = (Invoke-Api GET "/api/sla-policies" $admin).Data | Where-Object id -eq "P4" | Select-Object -First 1
Invoke-Api PUT "/api/sla-policies/P4" $admin @{ id = "P4"; range = $policy.range; min = $policy.min; max = $policy.max; response = $policy.response; resolution = $policy.resolution } | Out-Null
Assert-That ($router.id -eq $routerId) "admin router creation works"

$email = "qa-$suffix@nims.test"
$createdCustomer = (Invoke-Api POST "/api/customers" $admin @{ name = "QA Customer $suffix"; email = $email; password = "QaCustomer@123"; phone = "000"; address = "QA"; routerId = $routerId; status = "Active" }).Data
$createdUser = (Invoke-Api POST "/api/users" $admin @{ name = "QA Engineer $suffix"; email = "qa-eng-$suffix@nims.test"; password = "QaEngineer@123"; role = "engineer"; status = "Active" }).Data
Assert-That ($createdCustomer.routerId -eq $routerId -and $createdUser.role -eq "engineer") "admin customer and engineer creation works"
$qaCustomer = Login "qa-$suffix@nims.test" "QaCustomer@123" "customer"
$qaEngineer = Login "qa-eng-$suffix@nims.test" "QaEngineer@123" "engineer"

$created = (Invoke-Api POST "/api/incidents" $qaCustomer @{ title = "QA connectivity $suffix"; description = "Automated smoke workflow"; category = "Connectivity"; scope = "router"; routerId = $routerId; towerId = $tower.id }).Data
$incidentId = $created.incident.id
Assert-That ($created.incident.status -eq "Open" -and $created.incident.priority -eq $created.policy.id) "customer incident creation returns an SLA allocation"
$customerIncidents = (Invoke-Api GET "/api/incidents" $qaCustomer).Data
Assert-That (@($customerIncidents | Where-Object id -eq $incidentId).Count -eq 1) "customer can read its own incident"
Invoke-Api POST "/api/incidents/$incidentId/notes" $operator @{ text = "QA operator note" } | Out-Null
$escalated = (Invoke-Api POST "/api/incidents/$incidentId/escalate" $operator).Data
Assert-That ($escalated.status -eq "Escalated") "assigned operator can note and escalate incident"
Invoke-Api POST "/api/incidents/$incidentId/validate" $lead | Out-Null
$task = (Invoke-Api POST "/api/field-tasks" $lead @{ incidentId = $incidentId; engineer = $createdUser.name; instructions = "QA visit" }).Data
Assert-That ($task.engineer -eq $createdUser.name -and $task.status -eq "Scheduled") "lead assigns an active engineer"
$submitted = (Invoke-Api PUT "/api/field-tasks/$($task.id)/report" $qaEngineer @{ status = "Report submitted"; diagnosis = "Power supply fault"; report = "Replaced and tested" }).Data
Assert-That ($submitted.diagnosis -eq "Power supply fault" -and $submitted.status -eq "Report submitted") "assigned engineer submits diagnosis and repair report"
$rejected = (Invoke-Api POST "/api/field-tasks/$($task.id)/reject" $lead).Data
Assert-That ($rejected.status -eq "Rejected") "lead can reject a field report"
$resubmitted = (Invoke-Api PUT "/api/field-tasks/$($task.id)/report" $qaEngineer @{ status = "Report submitted"; diagnosis = "Power supply replaced"; report = "Retest passed" }).Data
Assert-That ($resubmitted.report -eq "Retest passed") "engineer can resubmit after rejection"
$verified = (Invoke-Api POST "/api/field-tasks/$($task.id)/verify" $lead).Data
Assert-That ($verified.status -eq "Completed") "lead can verify a resubmitted report"
$resolved = (Invoke-Api POST "/api/incidents/$incidentId/resolve" $lead).Data
Assert-That ($resolved.status -eq "Resolved") "lead resolves incident after field work"

$leadNotifications = (Invoke-Api GET "/api/notifications" $lead).Data
$unread = $leadNotifications | Where-Object { -not $_.read } | Select-Object -First 1
Assert-That ($null -ne $unread) "workflow generated a lead notification"
Invoke-Api PATCH "/api/notifications/$($unread.id)/read" $lead $null 204 | Out-Null
$readNotification = (Invoke-Api GET "/api/notifications" $lead).Data | Where-Object id -eq $unread.id | Select-Object -First 1
Assert-That ($readNotification.read) "notification read state persists"
$savedSettings = (Invoke-Api PUT "/api/settings" $lead @{ slaWarnings = $false; fieldUpdates = $true; compactTables = $true; timezone = "Asia/Kolkata" }).Data
$readSettings = (Invoke-Api GET "/api/settings" $lead).Data
Assert-That ($readSettings.compactTables -eq $savedSettings.compactTables) "settings survive a separate read"
$reports = (Invoke-Api GET "/api/reports" $admin).Data
$csv = (Invoke-Api GET "/api/reports/incidents.csv" $admin).Text
$audit = (Invoke-Api GET "/api/audit" $admin).Data
Assert-That ($reports.totalIncidents -gt 0 -and $csv.Contains($incidentId) -and $audit.Count -gt 0) "reports, CSV export, and audit records are available"

# Clean up disposable assets/accounts; incident and audit history stay as useful QA evidence.
Invoke-Api PUT "/api/customers/$($createdCustomer.id)" $admin @{ name = $createdCustomer.name; email = $email; phone = "000"; address = "QA"; routerId = $routerId; status = "Inactive" } | Out-Null
Invoke-Api DELETE "/api/users/$($createdUser.id)" $admin $null 204 | Out-Null
Invoke-Api DELETE "/api/routers/$routerId" $admin $null 204 | Out-Null
Invoke-Api DELETE "/api/towers/$($tower.id)" $admin $null 204 | Out-Null
$http.Dispose()
Write-Host "Completed $script:Passed smoke assertions. Disposable customer, engineer, router, and tower were deactivated; incident/audit records were retained."
