using ClubManager.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ClubManager.Api.Infrastructure;

public static class Administration
{
    public static async Task Run(WebApplication app, string[] args)
    {
        await using var scope = app.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (args.Contains("--migrate"))
        {
            var password = app.Configuration["App:DatabasePassword"] ?? throw new InvalidOperationException("Provide the application-role password securely.");
            if (password.Length < 24) throw new InvalidOperationException("Use at least 24 random characters for the database role.");
            await db.Database.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand("SELECT 1 FROM pg_roles WHERE rolname='club_app'", (NpgsqlConnection)db.Database.GetDbConnection());
            var exists = await cmd.ExecuteScalarAsync() is not null;
            // PostgreSQL role DDL does not accept a bind parameter for PASSWORD.
            // Only a fixed role name and correctly escaped string literal are used; command logging is disabled.
            cmd.CommandText = (exists ? "ALTER ROLE" : "CREATE ROLE") + " club_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '" + password.Replace("'", "''") + "'";
            await cmd.ExecuteNonQueryAsync(); await db.Database.MigrateAsync(); Console.WriteLine("P1 migrations applied; restricted application role configured."); return;
        }
        var index = Array.IndexOf(args, "--bootstrap-admin");
        if (index < 0 || index + 1 >= args.Length) throw new InvalidOperationException("Supply the verified administrator email as the next argument.");
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>(); var user = await users.FindByEmailAsync(args[index + 1]);
        if (user is null || !user.EmailConfirmed) throw new InvalidOperationException("The designated adult must register and verify their email first.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        var club = scope.ServiceProvider.GetRequiredService<ClubDb>();
        await club.Execute("SELECT pg_advisory_xact_lock(hashtext(@club))", ("club", ClubDb.PilotClub));
        if ((await club.Query("SELECT 1 FROM club.memberships WHERE club_id=@club AND role='admin' AND status='active'", ("club", Guid.Parse(ClubDb.PilotClub)))).Count > 0) throw new InvalidOperationException("Bootstrap is closed: an administrator already exists. Use an authorised staff invitation.");
        await club.Execute("INSERT INTO club.memberships(club_id,user_id,role) VALUES(@club,@user,'admin')", ("club", Guid.Parse(ClubDb.PilotClub)), ("user", user.Id));
        await club.Execute("INSERT INTO club.audit_events(club_id,actor_id,action,subject_id) VALUES(@club,'operator','admin.bootstrapped',@user)", ("club", Guid.Parse(ClubDb.PilotClub)), ("user", user.Id));
        await transaction.CommitAsync(); Console.WriteLine("First club administrator assigned. MFA is required before staff actions.");
    }
}
