using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/incidents"), Authorize(Roles = "admin,operator,lead,customer")]
public sealed class IncidentsController(NimsService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? priority, [FromQuery] string? category, [FromQuery] string? search, CancellationToken ct) =>
        Ok(await service.GetIncidentsAsync(Actor.From(User), status, priority, category, search, ct));

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct) => Ok(await service.GetIncidentAsync(id, Actor.From(User), ct));

    [HttpPost, Authorize(Roles = NimsRoles.Customer)]
    public async Task<IActionResult> Create(IncidentCreateRequest request, CancellationToken ct) => Ok(await service.CreateIncidentAsync(request, Actor.From(User), ct));

    [HttpPost("{id}/notes"), Authorize(Roles = "admin,operator,lead")]
    public async Task<IActionResult> AddNote(string id, NoteRequest request, CancellationToken ct) => Ok(await service.AddNoteAsync(id, request, Actor.From(User), ct));

    [HttpPost("{id}/escalate"), Authorize(Roles = NimsRoles.Operator)]
    public async Task<IActionResult> Escalate(string id, CancellationToken ct) => Ok(await service.EscalateAsync(id, Actor.From(User), ct));

    [HttpPost("{id}/validate"), Authorize(Roles = "admin,lead")]
    public async Task<IActionResult> Validate(string id, CancellationToken ct) => Ok(await service.ValidateIncidentAsync(id, Actor.From(User), ct));

    [HttpPost("{id}/resolve"), Authorize(Roles = "admin,operator,lead")]
    public async Task<IActionResult> Resolve(string id, CancellationToken ct) => Ok(await service.ResolveIncidentAsync(id, Actor.From(User), ct));
}
