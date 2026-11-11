using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/sla-policies"), Authorize]
public sealed class SlaPoliciesController(NimsService service) : ControllerBase
{
    [HttpGet, Authorize(Roles = "admin,operator,lead,customer")]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetPoliciesAsync(ct));

    [HttpPost, Authorize(Roles = NimsRoles.Admin)]
    public async Task<IActionResult> Create(SlaPolicyWriteRequest request, CancellationToken ct) => Ok(await service.CreatePolicyAsync(request, Actor.From(User), ct));

    [HttpPut("{id}"), Authorize(Roles = NimsRoles.Admin)]
    public async Task<IActionResult> Update(string id, SlaPolicyWriteRequest request, CancellationToken ct) => Ok(await service.UpdatePolicyAsync(id, request, Actor.From(User), ct));
}
