using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/network"), Authorize(Roles = "admin,lead,operator,customer")]
public sealed class NetworkController(NimsService service) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct) => Ok(await service.GetNetworkSummaryAsync(Actor.From(User), ct));
}
