using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/field-tasks"), Authorize(Roles = "admin,lead,engineer")]
public sealed class FieldTasksController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetFieldTasksAsync(Actor.From(User), ct));

    [HttpPost, Authorize(Roles = "admin,lead")]
    public async Task<IActionResult> Assign(FieldTaskWriteRequest request, CancellationToken ct) => Ok(await service.AssignFieldTaskAsync(request, Actor.From(User), ct));

    [HttpPut("{id}/report"), Authorize(Roles = NimsRoles.Engineer)]
    public async Task<IActionResult> SubmitReport(string id, FieldReportRequest request, CancellationToken ct)
    {
        try { return Ok(await service.SubmitFieldReportAsync(id, request, Actor.From(User), ct)); }
        catch (ApiException error)
        {
            return Problem(statusCode: error.StatusCode, title: error.Message);
        }
    }

    [HttpPost("{id}/verify"), Authorize(Roles = "admin,lead")]
    public async Task<IActionResult> Verify(string id, CancellationToken ct) => Ok(await service.VerifyFieldTaskAsync(id, true, Actor.From(User), ct));

    [HttpPost("{id}/reject"), Authorize(Roles = "admin,lead")]
    public async Task<IActionResult> Reject(string id, CancellationToken ct) => Ok(await service.VerifyFieldTaskAsync(id, false, Actor.From(User), ct));
}
