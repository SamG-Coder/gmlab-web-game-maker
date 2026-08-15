using System.Net;
using System.Text;
using Jint;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gmlab.Tests;

public sealed class GmlabFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var www = JsHarness.FindWwwRoot();
        var hostDir = Directory.GetParent(www)!.FullName;
        builder.UseContentRoot(hostDir);
        builder.UseWebRoot(www);
        builder.UseEnvironment("Development");
    }
}

public sealed class HostTests : IClassFixture<GmlabFactory>
{
    private readonly GmlabFactory _factory;

    public HostTests(GmlabFactory factory) => _factory = factory;

    [Fact]
    public async Task Ide_GetTwice_ReturnsEditorShell()
    {
        await AssertIdeAsync();
        await AssertIdeAsync();
    }

    [Fact]
    public async Task Health_IsAppPayload()
    {
        var client = _factory.CreateClient();
        var body = await client.GetStringAsync("/api/health");
        Assert.Contains("gmlab", body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sprite", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task StaticScripts_ArePlainFiles()
    {
        var client = _factory.CreateClient();
        var project = await client.GetStringAsync("/js/gmlab-project.js");
        Assert.Contains("Gmlab.Project", project);
        Assert.DoesNotContain("export default", project);
        var index = await client.GetStringAsync("/");
        Assert.Contains("<script src=\"js/gmlab-project.js\">", index);
        Assert.Contains("<script src=\"js/ide.js\">", index);
        Assert.DoesNotContain("type=\"module\"", index);
    }

    [Fact]
    public async Task Share_StoresAndServesStandaloneHtml_Twice()
    {
        var js = new JsHarness();
        js.LoadEngine();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'Hosted' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var obj = Gmlab.Project.addObject(p, { name: 'o', spriteId: spr.id, visible: true, solid: false, events: [] });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 64, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 2, y: 3 }]
            });
            var html = Gmlab.Export.toStandaloneHtml(p);
            """);
        var html = js.EvalString("html");

        var client = _factory.CreateClient();
        for (var i = 0; i < 2; i++)
        {
            using var post = new StringContent(html, Encoding.UTF8, "text/html");
            using var res = await client.PostAsync("/api/share", post);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadAsStringAsync();
            Assert.Contains("/s/", json);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var url = doc.RootElement.GetProperty("url").GetString();
            Assert.False(string.IsNullOrEmpty(url));
            var played = await client.GetStringAsync(url);
            Assert.Contains("<canvas id=\"game\"", played);
            Assert.Contains("GMLAB_PROJECT", played);
            js.Engine.SetValue("__playedHtml", played);
            Assert.Equal("Hosted", js.EvalString("Gmlab.Export.readProjectFromHtml(__playedHtml).name"));
            js.Engine.SetValue("__played", played);
            js.Eval("var g = Gmlab.Export.bootFromHtml(__played); Gmlab.Runtime.step(g);");
            Assert.True(js.EvalNumber("g.instances.length") >= 1);
        }
    }

    [Fact]
    public async Task GeminiProxy_MissingKey_IsAuthError()
    {
        var client = _factory.CreateClient();
        using var content = new StringContent("""{"prompt":"hi"}""", Encoding.UTF8, "application/json");
        using var res = await client.PostAsync("/api/gemini", content);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("auth:", body);
    }

    [Fact]
    public void IdeDocument_ListsAllFiveEditors()
    {
        var html = File.ReadAllText(Path.Combine(JsHarness.FindWwwRoot(), "index.html"));
        Assert.Contains("id=\"gmlab-ide\"", html);
        Assert.Contains("id=\"resource-tree\"", html);
        Assert.Contains("id=\"editor-host\"", html);
        Assert.Contains("sprite-editor.js", html);
        Assert.Contains("object-editor.js", html);
        Assert.Contains("room-editor.js", html);
        Assert.Contains("sound-editor.js", html);
        Assert.Contains("path-editor.js", html);
        Assert.Contains("id=\"play-stage\"", html);
    }

    private async Task AssertIdeAsync()
    {
        var client = _factory.CreateClient();
        using var res = await client.GetAsync("/");
        res.EnsureSuccessStatusCode();
        var html = await res.Content.ReadAsStringAsync();
        Assert.Contains("id=\"gmlab-ide\"", html);
        Assert.Contains("id=\"resource-tree\"", html);
        Assert.Contains("editor-shell", html);
        Assert.Contains("Gmlab", html);
        Assert.Contains("js/ide.js", html);
        Assert.False(string.IsNullOrWhiteSpace(html));
    }
}
