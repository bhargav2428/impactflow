using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/routers"), Authorize(Roles = NimsRoles.Admin)]
public sealed class RoutersController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetRoutersAsync(ct));
    [HttpPost] public async Task<IActionResult> Create(RouterWriteRequest request, CancellationToken ct) => Ok(await service.CreateRouterAsync(request, Actor.From(User), ct));
    [HttpPut("{id}")] public async Task<IActionResult> Update(string id, RouterWriteRequest request, CancellationToken ct) => Ok(await service.UpdateRouterAsync(id, request, Actor.From(User), ct));
    [HttpDelete("{id}")] public async Task<IActionResult> Deactivate(string id, CancellationToken ct) { await service.DeleteRouterAsync(id, Actor.From(User), ct); return NoContent(); }
}
