using ClubManager.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ClubManager.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261106061800_ClubAccess")]
public sealed class ClubAccess : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        using var stream = typeof(ClubAccess).Assembly.GetManifestResourceStream("ClubManager.Api.Data.security.sql")!;
        using var reader = new StreamReader(stream);
        migrationBuilder.Sql(reader.ReadToEnd());
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP SCHEMA club CASCADE;");
}
