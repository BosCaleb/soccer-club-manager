using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using ClubManager.Api.Auth;
using ClubManager.Api.Data;
using ClubManager.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args.Contains("--migrate") || args.Contains("--bootstrap-admin") ? [] : args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 16 * 1024);
builder.Logging.SetMinimumLevel(LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.None);
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
var connection = builder.Configuration.GetConnectionString("ClubDatabase") ?? throw new InvalidOperationException("Database configuration is required. See README.");
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection));
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor(); builder.Services.AddScoped<ClubDb>(); builder.Services.AddScoped<AccountMail>();
builder.Services.AddIdentity<AppUser, IdentityRole>(o =>
{
    o.User.RequireUniqueEmail = true; o.SignIn.RequireConfirmedEmail = true;
    o.Password.RequiredLength = 12; o.Password.RequiredUniqueChars = 4;
    o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
}).AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));
builder.Services.Configure<SecurityStampValidatorOptions>(o => { o.ValidationInterval = TimeSpan.Zero; o.OnRefreshingPrincipal = ctx => { if (ctx.CurrentPrincipal?.HasClaim("amr", "mfa") == true && ctx.NewPrincipal?.Identity is System.Security.Claims.ClaimsIdentity identity) identity.AddClaim(new System.Security.Claims.Claim("amr", "mfa")); return Task.CompletedTask; }; });
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "statedge.session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromHours(8); o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.Configure<Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationOptions>(IdentityConstants.TwoFactorUserIdScheme, o => { o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.ExpireTimeSpan = TimeSpan.FromMinutes(5); });
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "statedge.csrf"; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
var keyPath = builder.Configuration["App:KeyDirectory"] ?? throw new InvalidOperationException("A persistent, private Data Protection key directory is required.");
Directory.CreateDirectory(keyPath);
if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(keyPath, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
builder.Services.AddDataProtection().SetApplicationName("StatEdge").PersistKeysToFileSystem(new DirectoryInfo(keyPath));
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddPolicy("accounts", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })); });
var app = builder.Build();
if (args.Contains("--migrate") || args.Contains("--bootstrap-admin")) { await Administration.Run(app, args); return; }
await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await database.Database.OpenConnectionAsync();
    await using var cmd = new NpgsqlCommand("SELECT rolsuper OR rolbypassrls OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='club'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) FROM pg_roles WHERE rolname=current_user", (NpgsqlConnection)database.Database.GetDbConnection());
    if ((bool)(await cmd.ExecuteScalarAsync())!) throw new InvalidOperationException("Refusing to serve with privileged database credentials. Use the application role.");
}
if (!app.Environment.IsDevelopment())
{
    if (!Uri.TryCreate(app.Configuration["App:PublicOrigin"], UriKind.Absolute, out var origin) || origin.Scheme != "https") throw new InvalidOperationException("A fixed HTTPS public origin is required.");
    if (app.Configuration["Mail:Mode"] == "Local" || string.IsNullOrEmpty(app.Configuration["Smtp:Host"]) || string.IsNullOrEmpty(app.Configuration["Smtp:From"])) throw new InvalidOperationException("Configure a real email sender before production.");
    app.UseHsts();
}
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["Cache-Control"] = "no-store"; ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    try { await next(); }
    catch (BadHttpRequestException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { message = "Invalid request fields." }); }
    catch (Exception ex) when (ex is not OperationCanceledException)
    { if (ctx.Response.HasStarted) throw; ctx.Response.Clear(); ctx.Response.StatusCode = 503; await ctx.Response.WriteAsJsonAsync(new { message = "The service could not complete this request. Please try again." }); }
});
app.UseRouting(); app.UseAuthentication(); app.UseRateLimiter(); app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method))
    {
        try { await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx); }
        catch (AntiforgeryValidationException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { message = "Your session changed. Refresh and try again." }); return; }
    }
    if (ctx.Request.Path.StartsWithSegments("/api/health") || ctx.Request.Path == "/api/auth/csrf") { await next(); return; }
    var db = ctx.RequestServices.GetRequiredService<AppDbContext>();
    await using var transaction = await db.Database.BeginTransactionAsync();
    var club = ctx.RequestServices.GetRequiredService<ClubDb>(); await club.SetActor(club.Actor, club.Mfa);
    await next();
    // Failed password attempts must commit lockout counters, even when the response is 401.
    if (ctx.Response.StatusCode < 500) await transaction.CommitAsync();
});
app.MapGet("/api/health/live", () => Results.Ok(new { status = "alive", phase = "P1" }));
app.MapGet("/api/health/ready", async (AppDbContext db) =>
{ try { await db.Database.ExecuteSqlRawAsync("SELECT 1"); return Results.Ok(new { status = "ready", phase = "P1" }); } catch (NpgsqlException) { return Results.Json(new { status = "not_ready" }, statusCode: 503); } });
app.MapAccounts(); app.MapClubs();
app.MapMethods("/api/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE"], () => Results.NotFound()).RequireAuthorization();
app.Run();
