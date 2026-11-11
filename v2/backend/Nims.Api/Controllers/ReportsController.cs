using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/reports"), Authorize(Roles = NimsRoles.Admin)]
public sealed class ReportsController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken ct) => Ok(await service.GetReportsAsync(ct));
    [HttpGet("incidents.csv")] public async Task<IActionResult> ExportIncidents(CancellationToken ct) => File(System.Text.Encoding.UTF8.GetBytes(await service.ExportIncidentsCsvAsync(ct)), "text/csv; charset=utf-8", "nims-incidents.csv");
}
