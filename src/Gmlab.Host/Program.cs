using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

var contentRoot = builder.Environment.ContentRootPath;
var www = Path.Combine(contentRoot, "wwwroot");
if (!Directory.Exists(www) || !File.Exists(Path.Combine(www, "index.html")))
{
    var found = FindWwwRoot(contentRoot);
    if (found is not null)
    {
        builder.Environment.ContentRootPath = Path.GetDirectoryName(found)!;
        builder.Environment.WebRootPath = found;
    }
}

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 32 * 1024 * 1024;
});

builder.Services.AddHttpClient("gemini", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var shares = new ConcurrentDictionary<string, ShareRecord>(StringComparer.Ordinal);

app.MapGet("/api/health", () => Results.Json(new
{
    ok = true,
    app = "gmlab",
    title = "Gmlab Web Game Maker",
    editors = new[] { "sprite", "object", "room", "sound", "path" }
}));

app.MapPost("/api/share", async (HttpRequest request) =>
{
    string html;
    using (var reader = new StreamReader(request.Body, Encoding.UTF8))
    {
        html = await reader.ReadToEndAsync();
    }

    if (string.IsNullOrWhiteSpace(html))
    {
        return Results.BadRequest(new { error = "empty body" });
    }

    var id = Guid.NewGuid().ToString("n")[..12];
    shares[id] = new ShareRecord(html, DateTimeOffset.UtcNow);
    var url = $"/s/{id}";
    return Results.Json(new { id, url, absolutePath = url });
});

app.MapGet("/api/share/{id}", (string id) =>
{
    if (!shares.TryGetValue(id, out var rec))
    {
        return Results.NotFound(new { error = "share not found" });
    }

    return Results.Json(new { id, created = rec.Created, length = rec.Html.Length });
});

app.MapGet("/s/{id}", (string id) =>
{
    if (!shares.TryGetValue(id, out var rec))
    {
        return Results.Content(NotFoundPage(id), "text/html");
    }

    return Results.Content(rec.Html, "text/html");
});

app.MapPost("/api/gemini", async (HttpRequest request, IHttpClientFactory httpFactory) =>
{
    using var doc = await JsonDocument.ParseAsync(request.Body);
    var root = doc.RootElement;
    var apiKey = ReadApiKey(request, root);
    var prompt = root.TryGetProperty("prompt", out var p) ? p.GetString() ?? "" : "";
    var model = root.TryGetProperty("model", out var m) && m.ValueKind == JsonValueKind.String
        ? m.GetString()
        : "gemini-2.0-flash";
    var endpoint = root.TryGetProperty("endpoint", out var ep) && ep.ValueKind == JsonValueKind.String
        ? ep.GetString()
        : null;

    if (string.IsNullOrWhiteSpace(apiKey))
    {
        return Results.Json(new { error = "auth: missing API key" }, statusCode: 401);
    }

    var target = string.IsNullOrWhiteSpace(endpoint)
        ? $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Uri.EscapeDataString(apiKey)}"
        : AppendKey(endpoint!, apiKey);

    var payload = JsonSerializer.Serialize(new
    {
        contents = new[]
        {
            new { role = "user", parts = new[] { new { text = prompt } } }
        }
    });

    var client = httpFactory.CreateClient("gemini");
    using var msg = new HttpRequestMessage(HttpMethod.Post, target);
    msg.Content = new StringContent(payload, Encoding.UTF8, "application/json");
    msg.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
    msg.Headers.TryAddWithoutValidation("x-api-key", apiKey);

    HttpResponseMessage response;
    try
    {
        response = await client.SendAsync(msg);
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = "network: " + ex.Message });
    }

    var text = await response.Content.ReadAsStringAsync();
    if ((int)response.StatusCode is 401 or 403)
    {
        return Results.Json(new { error = "auth: invalid credential" }, statusCode: 401);
    }

    if (!response.IsSuccessStatusCode)
    {
        return Results.Json(new { error = $"http {(int)response.StatusCode}: {Trim(text, 400)}" });
    }

    try
    {
        using var parsed = JsonDocument.Parse(text);
        if (parsed.RootElement.TryGetProperty("text", out var echo) && echo.ValueKind == JsonValueKind.String)
        {
            return Results.Json(new { text = echo.GetString() });
        }

        var extracted = ExtractGeminiText(parsed.RootElement);
        return Results.Json(new { text = extracted ?? text });
    }
    catch (JsonException)
    {
        return Results.Json(new { text });
    }
});

app.MapFallbackToFile("index.html");
app.Run();

static string? FindWwwRoot(string start)
{
    var dir = new DirectoryInfo(start);
    for (var i = 0; i < 8 && dir is not null; i++, dir = dir.Parent)
    {
        var candidate = Path.Combine(dir.FullName, "wwwroot");
        if (File.Exists(Path.Combine(candidate, "index.html")))
        {
            return candidate;
        }

        candidate = Path.Combine(dir.FullName, "src", "Gmlab.Host", "wwwroot");
        if (File.Exists(Path.Combine(candidate, "index.html")))
        {
            return candidate;
        }
    }

    return null;
}

static string? ReadApiKey(HttpRequest request, JsonElement root)
{
    if (request.Headers.TryGetValue("x-api-key", out var header) && !string.IsNullOrWhiteSpace(header))
    {
        return header.ToString();
    }

    if (request.Headers.TryGetValue("x-goog-api-key", out var goog) && !string.IsNullOrWhiteSpace(goog))
    {
        return goog.ToString();
    }

    if (root.TryGetProperty("apiKey", out var k) && k.ValueKind == JsonValueKind.String)
    {
        return k.GetString();
    }

    if (root.TryGetProperty("credential", out var c) && c.ValueKind == JsonValueKind.String)
    {
        return c.GetString();
    }

    return request.Query["key"].FirstOrDefault();
}

static string AppendKey(string endpoint, string apiKey)
{
    if (endpoint.Contains("key=", StringComparison.OrdinalIgnoreCase))
    {
        return endpoint;
    }

    return endpoint + (endpoint.Contains('?') ? "&" : "?") + "key=" + Uri.EscapeDataString(apiKey);
}

static string? ExtractGeminiText(JsonElement root)
{
    if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
    {
        return null;
    }

    var cand = candidates[0];
    if (!cand.TryGetProperty("content", out var content))
    {
        return null;
    }

    if (!content.TryGetProperty("parts", out var parts) || parts.GetArrayLength() == 0)
    {
        return null;
    }

    if (parts[0].TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
    {
        return t.GetString();
    }

    return null;
}

static string Trim(string value, int max) =>
    value.Length <= max ? value : value[..max];

static string NotFoundPage(string id) =>
    "<!doctype html><meta charset=\"utf-8\"><title>Share not found</title>" +
    "<body style=\"font-family:sans-serif;padding:2rem\"><h1>Share not found</h1>" +
    "<p>No exported game is stored for id <code>" + id + "</code>. " +
    "Shares live in this host process — export again after a restart.</p></body>";

internal sealed record ShareRecord(string Html, DateTimeOffset Created);

public partial class Program;
