using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Nims.Api.Data;
using Nims.Api.Models;
using Nims.Api;
using Nims.Api.Security;
using Nims.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSingleton<NimsStore>();
builder.Services.AddSingleton<INimsStore>(services => services.GetRequiredService<NimsStore>());
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<NimsService>();
builder.Services.AddAuthentication("Bearer").AddScheme<AuthenticationSchemeOptions, BearerTokenHandler>("Bearer", _ => { });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("LocalUi", policy => policy
    .SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)
    .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
await app.Services.GetRequiredService<INimsStore>().InitializeAsync();

app.Use(async (context, next) =>
{
    try { await next(); }
    catch (Exception exception)
    {
        if (context.Response.HasStarted) throw;
        var status = exception is ApiException api ? api.StatusCode : StatusCodes.Status500InternalServerError;
        if (status == StatusCodes.Status500InternalServerError) app.Logger.LogError(exception, "Unhandled API error for {Path}", context.Request.Path);
        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        var message = exception is ApiException known ? known.Message : "An unexpected server error occurred.";
        await context.Response.WriteAsJsonAsync(new { type = "about:blank", title = message, status, traceId = context.TraceIdentifier }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }
});

app.UseCors("LocalUi");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/swagger/v1/swagger.json", () => Results.Json(OpenApiDocumentFactory.Create())).AllowAnonymous().ExcludeFromDescription();
app.MapGet("/swagger", () => Results.Content(OpenApiDocumentFactory.SwaggerUi, "text/html")).AllowAnonymous().ExcludeFromDescription();
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
app.MapGet("/openapi/v1.json", () => Results.Json(OpenApiDocumentFactory.Create())).AllowAnonymous().ExcludeFromDescription();
app.Run();
