using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/settings"), Authorize]
public sealed class SettingsController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken ct) => Ok(await service.GetSettingsAsync(Actor.From(User), ct));
    [HttpPut] public async Task<IActionResult> Save(SettingsWriteRequest request, CancellationToken ct) => Ok(await service.SaveSettingsAsync(request, Actor.From(User), ct));
}
