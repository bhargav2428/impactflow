using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Nims.Api.Controllers;

[ApiController, Route("api/health")]
public sealed class HealthController : ControllerBase
{
    [AllowAnonymous, HttpGet] public IActionResult Get() => Ok(new { status = "ok", service = "NIMS API", utc = DateTimeOffset.UtcNow });
}
