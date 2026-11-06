using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ClubManager.Api.Data;

public sealed class AppUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public DateTimeOffset AdultAttestedAt { get; set; }
}
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<AppUser>().Property(x => x.DisplayName).HasMaxLength(100);
        builder.Entity<AppUser>().HasIndex(x => x.NormalizedEmail).IsUnique();
    }
}
public sealed class DesignFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql(Environment.GetEnvironmentVariable("ConnectionStrings__ClubDatabase") ?? "Host=localhost;Database=clubmanager").Options);
}
