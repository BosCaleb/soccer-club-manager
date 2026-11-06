using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using ClubManager.Api.Data;
using ClubManager.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;

namespace ClubManager.Api.Auth;

public static class ClubEndpoints
{
    public sealed record InviteRequest(string Email, string Role);
    public sealed record AcceptRequest(string Token);
    public static void MapClubs(this WebApplication app)
    {
        var group = app.MapGroup("/api/clubs").RequireAuthorization().RequireRateLimiting("accounts");
        group.MapGet("/{clubId:guid}/members", async (Guid clubId, ClubDb db) =>
        {
            if (!await db.Admin(clubId)) return Results.Forbid();
            return Results.Ok(await db.Query("SELECT m.user_id, u.\"DisplayName\" AS display_name, m.role, m.status FROM club.memberships m JOIN public.\"AspNetUsers\" u ON u.\"Id\"=m.user_id WHERE club_id=@club ORDER BY u.\"DisplayName\",m.role", ("club", clubId)));
        });
        group.MapGet("/{clubId:guid}/audit", async (Guid clubId, ClubDb db) =>
        {
            if (!await db.Admin(clubId)) return Results.Forbid();
            return Results.Ok(await db.Query("SELECT id, actor_id, action, subject_id, at FROM club.audit_events WHERE club_id=@club ORDER BY at DESC LIMIT 100", ("club", clubId)));
        });
        group.MapGet("/{clubId:guid}/teams", async (Guid clubId, ClubDb db) =>
        {
            if (!db.Mfa) return Results.Forbid();
            return Results.Ok(await db.Query("SELECT id,name FROM club.teams WHERE club_id=@club ORDER BY name", ("club", clubId)));
        });
        group.MapGet("/{clubId:guid}/teams/{teamId:guid}", async (Guid clubId, Guid teamId, ClubDb db) =>
        {
            if (!db.Mfa) return Results.Forbid();
            var rows = await db.Query("SELECT id,name FROM club.teams WHERE club_id=@club AND id=@team", ("club", clubId), ("team", teamId));
            return rows.Count == 1 ? Results.Ok(rows[0]) : Results.NotFound();
        });
        group.MapPost("/{clubId:guid}/invitations", async (Guid clubId, InviteRequest input, ClubDb db, AccountMail mail) =>
        {
            if (!await db.Admin(clubId)) return Results.Forbid();
            if (!new[] { "coach", "manager", "admin" }.Contains(input.Role) || input.Email?.Length > 254 || !new EmailAddressAttribute().IsValid(input.Email)) return Results.BadRequest(new { message = "Choose a valid staff role and email address." });
            var email = input.Email!.Trim().ToUpperInvariant();
            await db.Execute("UPDATE club.invitations SET status='revoked' WHERE club_id=@club AND email=@email AND role=@role AND status='pending' AND expires_at<=now()", ("club", clubId), ("email", email), ("role", input.Role));
            var existing = await db.Query("SELECT id FROM club.invitations WHERE club_id=@club AND email=@email AND role=@role AND status='pending'", ("club", clubId), ("email", email), ("role", input.Role));
            if (existing.Count > 0) return Results.Conflict(new { message = "A pending invitation already exists. Revoke it before issuing another." });
            var id = Guid.NewGuid(); var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)); var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            await db.Execute("INSERT INTO club.invitations(id,club_id,email,role,created_by,token_hash,expires_at) VALUES (@id,@club,@email,@role,@actor,@hash,now()+interval '48 hours')", ("id", id), ("club", clubId), ("email", email), ("role", input.Role), ("actor", db.Actor), ("hash", hash));
            await db.Audit(clubId, "staff.invited", id.ToString());
            await mail.Send(input.Email.Trim(), "Join your club staff", "/accept-invitation", token);
            return Results.Ok(new { id, message = "Invitation sent. It expires in 48 hours." });
        });
        group.MapGet("/{clubId:guid}/invitations", async (Guid clubId, ClubDb db) => !await db.Admin(clubId) ? Results.Forbid() : Results.Ok(await db.Query("SELECT id,email,role,status,expires_at FROM club.invitations WHERE club_id=@club ORDER BY expires_at DESC LIMIT 100", ("club", clubId))));
        group.MapDelete("/{clubId:guid}/invitations/{id:guid}", async (Guid clubId, Guid id, ClubDb db) =>
        {
            if (!await db.Admin(clubId)) return Results.Forbid();
            var changed = await db.Execute("UPDATE club.invitations SET status='revoked' WHERE id=@id AND club_id=@club AND status='pending'", ("id", id), ("club", clubId));
            if (changed == 0) return Results.NotFound(); await db.Audit(clubId, "invitation.revoked", id.ToString()); return Results.Ok();
        });
        group.MapDelete("/{clubId:guid}/members/{userId}/{role}", async (Guid clubId, string userId, string role, ClubDb db) =>
        {
            await db.Execute("SELECT pg_advisory_xact_lock(hashtext(@club))", ("club", clubId.ToString()));
            if (!await db.Admin(clubId)) return Results.Forbid();
            if (role == "admin") { var admins = await db.Query("SELECT user_id FROM club.memberships WHERE club_id=@club AND role='admin' AND status='active'", ("club", clubId)); if (admins.Count <= 1) return Results.Conflict(new { message = "Keep at least one active club administrator." }); }
            var changed = await db.Execute("UPDATE club.memberships SET status='revoked' WHERE club_id=@club AND user_id=@user AND role=@role AND status='active'", ("club", clubId), ("user", userId), ("role", role));
            if (changed == 0) return Results.NotFound();
            await db.Execute("UPDATE club.invitations SET status='revoked' WHERE club_id=@club AND role=@role AND status='pending' AND email=(SELECT \"NormalizedEmail\" FROM public.\"AspNetUsers\" WHERE \"Id\"=@user)", ("club", clubId), ("role", role), ("user", userId));
            await db.Audit(clubId, "membership.revoked." + role, userId); return Results.Ok();
        });
        app.MapPost("/api/invitations/accept", async (AcceptRequest input, HttpContext ctx, UserManager<AppUser> users, ClubDb db) =>
        {
            var user = (await users.GetUserAsync(ctx.User))!;
            if (input.Token is null || input.Token.Length != 64 || !user.EmailConfirmed) return Results.BadRequest(new { message = "Invitation unavailable." });
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input.Token));
            var rows = await db.Query("SELECT id,club_id,role FROM club.invitations WHERE token_hash=@hash AND email=@email AND status='pending' AND expires_at>now() FOR UPDATE", ("hash", hash), ("email", user.NormalizedEmail!));
            if (rows.Count != 1) return Results.NotFound(new { message = "Invitation is invalid, expired, already used or belongs to another account." });
            var row = rows[0]; var id = (Guid)row["id"]!; var club = (Guid)row["club_id"]!; var role = (string)row["role"]!;
            await db.Execute("SELECT set_config('app.invitation_id',@id,true)", ("id", id.ToString()));
            await db.Execute("INSERT INTO club.memberships(club_id,user_id,role) VALUES (@club,@user,@role) ON CONFLICT(club_id,user_id,role) DO UPDATE SET status='active'", ("club", club), ("user", user.Id), ("role", role));
            await db.Execute("UPDATE club.invitations SET status='accepted' WHERE id=@id", ("id", id));
            await db.Audit(club, "invitation.accepted." + role, user.Id);
            return Results.Ok(new { message = "Invitation accepted. Set up MFA before using staff tools." });
        }).RequireAuthorization().RequireRateLimiting("accounts");
    }
}
