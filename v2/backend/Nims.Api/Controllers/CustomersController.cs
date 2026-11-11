using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nims.Api.Models;
using Nims.Api.Services;

namespace Nims.Api.Controllers;

[ApiController, Route("api/customers"), Authorize]
public sealed class CustomersController(NimsService service) : ControllerBase
{
    [HttpGet, Authorize(Roles = "admin,customer")]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.GetCustomersAsync(Actor.From(User), ct));

    [HttpPost, Authorize(Roles = NimsRoles.Admin)]
    public async Task<IActionResult> Create(CustomerWriteRequest request, CancellationToken ct) => Ok(await service.CreateCustomerAsync(request, Actor.From(User), ct));

    [HttpPut("{id}"), Authorize(Roles = NimsRoles.Admin)]
    public async Task<IActionResult> Update(string id, CustomerWriteRequest request, CancellationToken ct) => Ok(await service.UpdateCustomerAsync(id, request, Actor.From(User), ct));
}
