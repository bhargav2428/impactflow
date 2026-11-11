using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/users"), Authorize(Roles = NimsRoles.Admin)]
public sealed class UsersController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetUsersSafeAsync(ct));
    [HttpPost] public async Task<IActionResult> Create(UserWriteRequest request, CancellationToken ct) => Ok(await service.CreateUserAsync(request, Actor.From(User), ct));
    [HttpPut("{id}")] public async Task<IActionResult> Update(string id, UserWriteRequest request, CancellationToken ct) => Ok(await service.UpdateUserAsync(id, request, Actor.From(User), ct));
    [HttpDelete("{id}")] public async Task<IActionResult> Deactivate(string id, CancellationToken ct) { await service.DeleteUserAsync(id, Actor.From(User), ct); return NoContent(); }
}
