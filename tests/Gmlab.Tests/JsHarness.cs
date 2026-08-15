using System.Net;
using System.Text;
using Jint;
using Jint.Native;

namespace Gmlab.Tests;

public sealed class JsHarness
{
    public Engine Engine { get; }

    public static readonly string[] BrowserScripts =
    [
        "gmlab-project.js",
        "gmlab-docs.js",
        "gmlab-runtime.js",
        "gmlab-export.js",
        "gmlab-share.js",
        "gmlab-gemini.js",
        "gmlab-sample.js",
        Path.Combine("editors", "sprite-editor.js"),
        Path.Combine("editors", "object-editor.js"),
        Path.Combine("editors", "room-editor.js"),
        Path.Combine("editors", "sound-editor.js"),
        Path.Combine("editors", "path-editor.js"),
        "ide.js"
    ];

    public static readonly IReadOnlyDictionary<string, string> ExpectedGlobals = new Dictionary<string, string>
    {
        ["gmlab-project.js"] = "Gmlab.Project",
        ["gmlab-docs.js"] = "Gmlab.Docs",
        ["gmlab-runtime.js"] = "Gmlab.Runtime",
        ["gmlab-export.js"] = "Gmlab.Export",
        ["gmlab-share.js"] = "Gmlab.Share",
        ["gmlab-gemini.js"] = "Gmlab.Gemini",
        ["gmlab-sample.js"] = "Gmlab.Sample",
        [Path.Combine("editors", "sprite-editor.js")] = "Gmlab.Editors.sprite",
        [Path.Combine("editors", "object-editor.js")] = "Gmlab.Editors.object",
        [Path.Combine("editors", "room-editor.js")] = "Gmlab.Editors.room",
        [Path.Combine("editors", "sound-editor.js")] = "Gmlab.Editors.sound",
        [Path.Combine("editors", "path-editor.js")] = "Gmlab.Editors.path",
        ["ide.js"] = "Gmlab.IDE"
    };

    public JsHarness(bool browserSandbox = true)
    {
        Engine = new Engine(options =>
        {
            options.Strict(false);
            options.TimeoutInterval(TimeSpan.FromSeconds(15));
            options.CancellationToken(CancellationToken.None);
        });

        if (browserSandbox)
        {
            Engine.Execute("var window = this; window.window = window; this.window = window;");
            Engine.Execute("if (typeof module !== 'undefined') { throw new Error('module must not exist'); }");
            Engine.Execute("if (typeof require !== 'undefined') { throw new Error('require must not exist'); }");
            Engine.Execute("if (typeof exports !== 'undefined') { throw new Error('exports must not exist'); }");
        }
        else
        {
            Engine.Execute("var window = this;");
        }
    }

    public void Load(params string[] relativeJsPaths)
    {
        var www = FindWwwRoot();
        foreach (var rel in relativeJsPaths)
        {
            var path = Path.Combine(www, "js", rel);
            var code = File.ReadAllText(path);
            Engine.Execute(code, rel);
        }
    }

    public void LoadAllShipped() => Load(BrowserScripts);

    public void LoadEngine()
    {
        Load("gmlab-project.js", "gmlab-docs.js", "gmlab-runtime.js", "gmlab-export.js", "gmlab-share.js", "gmlab-gemini.js", "gmlab-sample.js");
        WireExportSources();
    }

    public void WireExportSources()
    {
        var www = FindWwwRoot();
        var projectSrc = File.ReadAllText(Path.Combine(www, "js", "gmlab-project.js"));
        var runtimeSrc = File.ReadAllText(Path.Combine(www, "js", "gmlab-runtime.js"));
        Engine.SetValue("__projectSrc", projectSrc);
        Engine.SetValue("__runtimeSrc", runtimeSrc);
        Engine.Execute("Gmlab.Export.setSources({ project: __projectSrc, runtime: __runtimeSrc });");
    }

    public JsValue Eval(string code) => Engine.Evaluate(code);

    public string EvalString(string code)
    {
        var v = Engine.Evaluate(code);
        return v.IsNull() || v.IsUndefined() ? "" : v.ToString();
    }

    public double EvalNumber(string code)
    {
        var v = Engine.Evaluate(code);
        var obj = v.ToObject();
        return obj is null ? double.NaN : Convert.ToDouble(obj);
    }

    public bool EvalBool(string code)
    {
        var obj = Engine.Evaluate(code).ToObject();
        return obj is bool b ? b : Convert.ToBoolean(obj);
    }

    public void InstallSyncHttpPost()
    {
        Engine.SetValue("__syncHttpPost", new Func<JsValue, JsValue>(req =>
        {
            var url = req.Get("url").ToString();
            var body = req.Get("body").ToString();
            var apiKey = req.Get("apiKey").ToString();
            using var client = new HttpClient();
            using var message = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrEmpty(apiKey))
            {
                message.Headers.TryAddWithoutValidation("x-api-key", apiKey);
                message.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
            }

            message.Content = new StringContent(body ?? "", System.Text.Encoding.UTF8, "application/json");
            using var resp = client.Send(message);
            var text = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            Engine.SetValue("__hpStatus", (int)resp.StatusCode);
            Engine.SetValue("__hpBody", text);
            return Engine.Evaluate("({ status: __hpStatus, body: __hpBody })");
        }));
    }

    public void InstallFetch(Func<string, string, IReadOnlyDictionary<string, string>, string, (int Status, string Body)> send)
    {
        Engine.SetValue("__dotnetFetch", new Func<string, string, string, string, JsValue>((url, method, headersJson, body) =>
        {
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(headersJson))
            {
                using var doc = System.Text.Json.JsonDocument.Parse(headersJson);
                foreach (var p in doc.RootElement.EnumerateObject())
                {
                    headers[p.Name] = p.Value.ToString();
                }
            }

            var (status, respBody) = send(url, method, headers, body ?? "");
            Engine.SetValue("__fetchStatus", status);
            Engine.SetValue("__fetchBody", respBody);
            return Engine.Evaluate("({ status: __fetchStatus, body: __fetchBody })");
        }));

        Engine.Execute("""
            function fetch(url, init) {
              init = init || {};
              var result = __dotnetFetch(url, init.method || "GET", JSON.stringify(init.headers || {}), init.body || "");
              return Promise.resolve({
                status: result.status,
                ok: result.status >= 200 && result.status < 300,
                text: function () { return Promise.resolve(result.body); },
                json: function () { return Promise.resolve(JSON.parse(result.body)); }
              });
            }
            window.fetch = fetch;
            """);
    }

    public static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "src", "Gmlab.Host", "wwwroot")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate repo root from " + AppContext.BaseDirectory);
    }

    public static string FindWwwRoot() =>
        Path.Combine(FindRepoRoot(), "src", "Gmlab.Host", "wwwroot");

    public static string ReadJs(string relative) =>
        File.ReadAllText(Path.Combine(FindWwwRoot(), "js", relative));
}

public sealed class EchoServer : IDisposable
{
    private readonly HttpListener _listener;
    private readonly Thread _thread;
    private volatile bool _running = true;

    public string Prefix { get; }
    public List<(string Url, string Body, string? ApiKey)> Requests { get; } = [];

    public EchoServer()
    {
        var port = GetFreePort();
        Prefix = $"http://127.0.0.1:{port}/";
        _listener = new HttpListener();
        _listener.Prefixes.Add(Prefix);
        _listener.Start();
        _thread = new Thread(Loop) { IsBackground = true };
        _thread.Start();
    }

    public string EchoUrl => Prefix + "echo";

    private void Loop()
    {
        while (_running)
        {
            HttpListenerContext? ctx = null;
            try
            {
                ctx = _listener.GetContext();
            }
            catch (HttpListenerException)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }

            if (ctx is null) continue;
            var request = ctx.Request;
            using var response = ctx.Response;
            string body;
            using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
            {
                body = reader.ReadToEnd();
            }

            var key = request.Headers["x-api-key"]
                      ?? request.Headers["x-goog-api-key"]
                      ?? request.QueryString["key"];
            lock (Requests)
            {
                Requests.Add((request.Url?.ToString() ?? "", body, key));
            }

            int status;
            string payload;
            if (string.IsNullOrEmpty(key))
            {
                status = 401;
                payload = """{"error":"auth: missing API key"}""";
            }
            else if (key is "bad" or "invalid")
            {
                status = 401;
                payload = """{"error":"auth: invalid credential"}""";
            }
            else
            {
                status = 200;
                var prompt = ExtractPrompt(body);
                payload = System.Text.Json.JsonSerializer.Serialize(new { text = "echo:" + prompt });
            }

            var bytes = Encoding.UTF8.GetBytes(payload);
            response.StatusCode = status;
            response.ContentType = "application/json";
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
        }
    }

    private static string ExtractPrompt(string body)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("prompt", out var p)) return p.GetString() ?? "";
            if (doc.RootElement.TryGetProperty("contents", out var contents) && contents.GetArrayLength() > 0)
            {
                var parts = contents[0].GetProperty("parts");
                if (parts.GetArrayLength() > 0 && parts[0].TryGetProperty("text", out var t))
                {
                    return t.GetString() ?? "";
                }
            }
        }
        catch (System.Text.Json.JsonException)
        {
            /* ignore */
        }

        return body;
    }

    private static int GetFreePort()
    {
        var l = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
        l.Start();
        var port = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    public void Dispose()
    {
        _running = false;
        try { _listener.Stop(); } catch { /* ignore */ }
        try { _listener.Close(); } catch { /* ignore */ }
    }
}
