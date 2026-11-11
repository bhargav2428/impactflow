using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/notifications"), Authorize]
public sealed class NotificationsController(NimsService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetNotificationsAsync(Actor.From(User), ct));
    [HttpPatch("{id}/read")] public async Task<IActionResult> MarkRead(string id, CancellationToken ct) { await service.MarkNotificationReadAsync(id, Actor.From(User), ct); return NoContent(); }
}
