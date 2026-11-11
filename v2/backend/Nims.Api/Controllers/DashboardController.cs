using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/dashboard"), Authorize]
public sealed class DashboardController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken ct) => Ok(await service.GetDashboardAsync(Actor.From(User), ct));
}
