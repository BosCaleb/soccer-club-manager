using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ClubManager.Api.Data;
using ClubManager.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

namespace ClubManager.Api.Auth;

public static class AuthEndpoints
{
    public sealed record Register(string Email, string Password, string DisplayName, bool AdultConfirmed);
    public sealed record Login(string Email, string Password);
    public sealed record EmailRequest(string Email);
    public sealed record TokenRequest(string UserId, string Token);
    public sealed record Reset(string UserId, string Token, string Password);
    public sealed record CodeRequest(string Code, bool Recovery = false);
    public sealed record PasswordRequest(string Password);
    public sealed record ProfileRequest(string DisplayName);
    private static IResult Invalid(string message = "Check the supplied details and try again.") => Results.BadRequest(new { message });
    private static IResult GenericMail() => Results.Ok(new { message = "If this request is eligible, an email will arrive with the next step." });
    public static void MapAccounts(this WebApplication app)
    {
        app.MapGet("/api/auth/csrf", (HttpContext ctx, IAntiforgery antiforgery) => Results.Ok(new { token = antiforgery.GetAndStoreTokens(ctx).RequestToken }));
        var group = app.MapGroup("/api/auth").RequireRateLimiting("accounts");
        group.MapPost("/register", async (Register input, UserManager<AppUser> users, ClubDb db, AccountMail mail) =>
        {
            if (!input.AdultConfirmed || string.IsNullOrWhiteSpace(input.DisplayName) || input.DisplayName.Trim().Length > 100 || input.Email?.Length > 254 || !new EmailAddressAttribute().IsValid(input.Email) || input.Password is null || input.Password.Length > 128) return Invalid("Confirm you are an adult and enter a valid name, email and password.");
            if (await users.FindByEmailAsync(input.Email!) is not null) return GenericMail();
            var user = new AppUser { UserName = input.Email!.Trim(), Email = input.Email.Trim(), DisplayName = input.DisplayName.Trim(), AdultAttestedAt = DateTimeOffset.UtcNow };
            var created = await users.CreateAsync(user, input.Password);
            if (!created.Succeeded) return Invalid("Use at least 12 characters including an uppercase letter, lowercase letter, number and symbol.");
            await mail.Send(user.Email, "Verify your email", "/verify-email", await users.GenerateEmailConfirmationTokenAsync(user), user.Id);
            return GenericMail();
        });
        group.MapPost("/verify-email", async (TokenRequest input, UserManager<AppUser> users, ClubDb db) =>
        {
            if (string.IsNullOrWhiteSpace(input.UserId) || string.IsNullOrWhiteSpace(input.Token) || input.UserId.Length > 128 || input.Token.Length > 2048) return Invalid("This link is invalid or expired.");
            var user = await users.FindByIdAsync(input.UserId);
            if (user is null || user.EmailConfirmed || !(await users.ConfirmEmailAsync(user, input.Token)).Succeeded) return Invalid("This verification link is invalid, expired or already used.");
            await db.SetActor(user.Id);
            await db.Execute("INSERT INTO club.memberships(club_id,user_id,role) VALUES (@club,@user,'guardian') ON CONFLICT DO NOTHING", ("club", Guid.Parse(ClubDb.PilotClub)), ("user", user.Id));
            await db.Execute("INSERT INTO club.audit_events(club_id,actor_id,action,subject_id) VALUES (@club,@user,'guardian.verified',@user)", ("club", Guid.Parse(ClubDb.PilotClub)), ("user", user.Id));
            return Results.Ok(new { message = "Email verified. You can now sign in." });
        });
        group.MapPost("/resend-verification", async (EmailRequest input, UserManager<AppUser> users, AccountMail mail) =>
        {
            var user = await users.FindByEmailAsync(input.Email ?? "");
            if (user is not null && !user.EmailConfirmed) await mail.Send(user.Email!, "Verify your email", "/verify-email", await users.GenerateEmailConfirmationTokenAsync(user), user.Id);
            return GenericMail();
        });
        group.MapPost("/login", async (Login input, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            if (input.Password is null || input.Password.Length > 128) return Results.Unauthorized();
            var user = await users.FindByEmailAsync(input.Email ?? "");
            if (user is null) { new PasswordHasher<AppUser>().HashPassword(new AppUser(), input.Password); return Results.Unauthorized(); }
            var result = await signIn.PasswordSignInAsync(user, input.Password, false, true);
            if (result.RequiresTwoFactor) return Results.Ok(new { requiresTwoFactor = true });
            return result.Succeeded ? Results.Ok(new { requiresTwoFactor = false }) : Results.Unauthorized();
        });
        group.MapPost("/login/mfa", async (CodeRequest input, SignInManager<AppUser> signIn, UserManager<AppUser> users) =>
        {
            var user = await signIn.GetTwoFactorAuthenticationUserAsync();
            if (user is null || await users.IsLockedOutAsync(user)) return Results.Unauthorized();
            var result = input.Recovery ? await signIn.TwoFactorRecoveryCodeSignInAsync(input.Code ?? "") : await signIn.TwoFactorAuthenticatorSignInAsync((input.Code ?? "").Replace(" ", ""), false, false);
            if (input.Recovery && !result.Succeeded) await users.AccessFailedAsync(user);
            return result.Succeeded ? Results.Ok() : Results.Unauthorized();
        });
        group.MapPost("/forgot-password", async (EmailRequest input, UserManager<AppUser> users, AccountMail mail) =>
        {
            var user = await users.FindByEmailAsync(input.Email ?? "");
            if (user?.EmailConfirmed == true) await mail.Send(user.Email!, "Reset your password", "/reset-password", await users.GeneratePasswordResetTokenAsync(user), user.Id);
            return GenericMail();
        });
        group.MapPost("/reset-password", async (Reset input, UserManager<AppUser> users) =>
        {
            if (input.Password is null || input.Password.Length > 128) return Invalid();
            if (string.IsNullOrWhiteSpace(input.UserId) || string.IsNullOrWhiteSpace(input.Token) || input.UserId.Length > 128 || input.Token.Length > 2048) return Invalid("This link is invalid or expired.");
            var user = await users.FindByIdAsync(input.UserId);
            if (user is null || !(await users.ResetPasswordAsync(user, input.Token, input.Password)).Succeeded) return Invalid("The link is invalid or expired, or the new password does not meet the requirements.");
            await users.SetLockoutEndDateAsync(user, null); await users.ResetAccessFailedCountAsync(user);
            return Results.Ok(new { message = "Password updated. Sign in again on your devices." });
        });
        group.MapGet("/me", async (HttpContext ctx, UserManager<AppUser> users, ClubDb db) =>
        {
            var user = await users.GetUserAsync(ctx.User);
            if (user is null) return Results.Unauthorized();
            var memberships = await db.Query("SELECT m.club_id, c.name AS club_name, m.role FROM club.memberships m JOIN club.clubs c ON c.id=m.club_id WHERE m.user_id=@user AND m.status='active' ORDER BY m.role", ("user", user.Id));
            return Results.Ok(new { user.Id, user.DisplayName, user.Email, user.EmailConfirmed, user.TwoFactorEnabled, mfaVerified = db.Mfa, memberships });
        }).RequireAuthorization();
        group.MapPost("/logout", async (HttpContext ctx, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        { var user = await users.GetUserAsync(ctx.User); if (user is not null) await users.UpdateSecurityStampAsync(user); await signIn.SignOutAsync(); return Results.Ok(); }).RequireAuthorization();
        group.MapPost("/profile", async (ProfileRequest input, HttpContext ctx, UserManager<AppUser> users) =>
        {
            if (string.IsNullOrWhiteSpace(input.DisplayName) || input.DisplayName.Trim().Length > 100) return Invalid("Enter a name between 1 and 100 characters.");
            var user = (await users.GetUserAsync(ctx.User))!; user.DisplayName = input.DisplayName.Trim(); await users.UpdateAsync(user); return Results.Ok();
        }).RequireAuthorization();
        group.MapPost("/mfa/setup", async (PasswordRequest input, HttpContext ctx, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = (await users.GetUserAsync(ctx.User))!;
            if (await users.IsLockedOutAsync(user) || !(await users.CheckPasswordAsync(user, input.Password ?? ""))) { await users.AccessFailedAsync(user); return Results.Unauthorized(); }
            if (user.TwoFactorEnabled) return Invalid("MFA is already enabled. Use your authenticator or saved recovery codes.");
            var key = await users.GetAuthenticatorKeyAsync(user);
            if (key is null) { await users.ResetAuthenticatorKeyAsync(user); key = await users.GetAuthenticatorKeyAsync(user); await signIn.RefreshSignInAsync(user); }
            return Results.Ok(new { key, account = user.Email, issuer = "StatEdge" });
        }).RequireAuthorization();
        group.MapPost("/mfa/enable", async (CodeRequest input, HttpContext ctx, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = (await users.GetUserAsync(ctx.User))!;
            if (user.TwoFactorEnabled) return Invalid("MFA is already enabled.");
            if (await users.IsLockedOutAsync(user) || !(await users.VerifyTwoFactorTokenAsync(user, users.Options.Tokens.AuthenticatorTokenProvider, (input.Code ?? "").Replace(" ", "")))) { await users.AccessFailedAsync(user); return Invalid("The code is incorrect. Check your authenticator and try again."); }
            await users.ResetAccessFailedCountAsync(user); await users.SetTwoFactorEnabledAsync(user, true); await users.UpdateSecurityStampAsync(user);
            var recoveryCodes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, 8);
            await signIn.SignInWithClaimsAsync(user, false, [new Claim("amr", "mfa")]);
            return Results.Ok(new { recoveryCodes });
        }).RequireAuthorization();
    }
}
