using System.Text.Json;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ClubManager.Api.Infrastructure;

public sealed class AccountMail(IConfiguration config, IWebHostEnvironment environment)
{
    public async Task Send(string to, string purpose, string path, string token, string? userId = null)
    {
        var origin = config["App:PublicOrigin"] ?? "http://localhost:5173";
        var url = origin.TrimEnd('/') + path + "?token=" + Uri.EscapeDataString(token) + (userId is null ? "" : "&userId=" + Uri.EscapeDataString(userId));
        if (environment.IsDevelopment() && config["Mail:Mode"] == "Local")
        {
            var directory = config["Mail:Directory"] ?? throw new InvalidOperationException("Local mail directory is required.");
            Directory.CreateDirectory(directory);
            if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            var file = Path.Combine(directory, Guid.NewGuid() + ".json");
            var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write };
            if (!OperatingSystem.IsWindows()) options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            await using var stream = new FileStream(file, options);
            await JsonSerializer.SerializeAsync(stream, new { to, purpose, url, createdAt = DateTimeOffset.UtcNow });
            return;
        }
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(config["Smtp:From"] ?? throw new InvalidOperationException("Email sender is not configured.")));
        message.To.Add(MailboxAddress.Parse(to)); message.Subject = "StatEdge: " + purpose;
        message.Body = new TextPart("plain") { Text = $"{purpose}\n\nOpen this link to continue:\n{url}\n\nIf you did not request this, ignore this email. Do not share the link." };
        using var smtp = new SmtpClient(); smtp.Timeout = 15000;
        await smtp.ConnectAsync(config["Smtp:Host"] ?? throw new InvalidOperationException("SMTP host is required."), config.GetValue("Smtp:Port", 587), SecureSocketOptions.StartTls);
        if (!string.IsNullOrEmpty(config["Smtp:Username"])) await smtp.AuthenticateAsync(config["Smtp:Username"]!, config["Smtp:Password"] ?? "");
        await smtp.SendAsync(message); await smtp.DisconnectAsync(true);
    }
}
