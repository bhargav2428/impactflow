using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/towers"), Authorize(Roles = NimsRoles.Admin)]
public sealed class TowersController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetTowersAsync(ct));
    [HttpPost] public async Task<IActionResult> Create(TowerWriteRequest request, CancellationToken ct) => Ok(await service.CreateTowerAsync(request, Actor.From(User), ct));
    [HttpPut("{id}")] public async Task<IActionResult> Update(string id, TowerWriteRequest request, CancellationToken ct) => Ok(await service.UpdateTowerAsync(id, request, Actor.From(User), ct));
    [HttpDelete("{id}")] public async Task<IActionResult> Deactivate(string id, CancellationToken ct) { await service.DeleteTowerAsync(id, Actor.From(User), ct); return NoContent(); }
}
