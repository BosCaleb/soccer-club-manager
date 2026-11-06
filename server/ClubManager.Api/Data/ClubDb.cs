using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace ClubManager.Api.Data;

public sealed class ClubDb(AppDbContext db, IHttpContextAccessor accessor)
{
    public const string PilotClub = "11111111-1111-4111-8111-111111111111";
    public string Actor => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
    public bool Mfa => accessor.HttpContext?.User.HasClaim("amr", "mfa") == true;
    public async Task SetActor(string actor, bool mfa = false)
    {
        await Execute("SELECT set_config('app.user_id', @actor, true), set_config('app.mfa', @mfa, true)", ("actor", actor), ("mfa", mfa ? "true" : "false"));
    }
    private NpgsqlCommand Command(string sql, (string, object)[] args)
    {
        var cmd = new NpgsqlCommand(sql, (NpgsqlConnection)db.Database.GetDbConnection(), (NpgsqlTransaction?)db.Database.CurrentTransaction?.GetDbTransaction());
        foreach (var (key, value) in args) cmd.Parameters.AddWithValue(key, value);
        return cmd;
    }
    public async Task<int> Execute(string sql, params (string, object)[] args)
    { await using var cmd = Command(sql, args); return await cmd.ExecuteNonQueryAsync(); }
    public async Task<List<Dictionary<string, object?>>> Query(string sql, params (string, object)[] args)
    {
        await using var cmd = Command(sql, args); await using var reader = await cmd.ExecuteReaderAsync();
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync()) { var row = new Dictionary<string, object?>(); for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i); rows.Add(row); }
        return rows;
    }
    public async Task<bool> Admin(Guid club) => Mfa && (await Query("SELECT 1 FROM club.memberships WHERE club_id=@club AND user_id=@actor AND role='admin' AND status='active'", ("club", club), ("actor", Actor))).Count > 0;
    public Task<int> Audit(Guid club, string action, string subject) => Execute("INSERT INTO club.audit_events(club_id,actor_id,action,subject_id) VALUES (@club,@actor,@action,@subject)", ("club", club), ("actor", Actor), ("action", action), ("subject", subject));
}
