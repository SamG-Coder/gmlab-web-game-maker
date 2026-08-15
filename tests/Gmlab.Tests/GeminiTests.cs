using Jint;
using Jint.Native;

namespace Gmlab.Tests;

public sealed class GeminiTests
{
    [Fact]
    public void Complete_SendsCredentialAndPrompt_ReturnsEchoText()
    {
        using var echo = new EchoServer();
        var js = new JsHarness();
        js.Load("gmlab-gemini.js");
        js.InstallFetch((url, method, headers, body) =>
        {
            using var client = new HttpClient();
            using var req = new HttpRequestMessage(new HttpMethod(method), url);
            foreach (var h in headers)
            {
                if (h.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
                req.Headers.TryAddWithoutValidation(h.Key, h.Value);
            }

            if (!string.IsNullOrEmpty(body))
            {
                req.Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
            }

            using var resp = client.Send(req);
            var text = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return ((int)resp.StatusCode, text);
        });

        js.Engine.SetValue("__endpoint", echo.EchoUrl);
        js.InstallSyncHttpPost();
        var result = js.Eval("""
            Gmlab.Gemini.complete({
              apiKey: 'test-key-123',
              prompt: 'hello gmlab',
              endpoint: __endpoint,
              httpPost: function (req) { return __syncHttpPost(req); }
            })
            """).UnwrapIfPromise(TimeSpan.FromSeconds(5));
        js.Engine.SetValue("__r", result);
        Assert.Equal("echo:hello gmlab", js.EvalString("__r.text"));
        Assert.True(string.IsNullOrEmpty(js.EvalString("__r.error")) || js.EvalString("__r.error") == "undefined");

        lock (echo.Requests)
        {
            Assert.NotEmpty(echo.Requests);
            var hit = echo.Requests[0];
            Assert.Equal("test-key-123", hit.ApiKey);
            Assert.Contains("hello gmlab", hit.Body, StringComparison.Ordinal);
            Assert.Contains("test-key-123", hit.Url + hit.Body, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Complete_MissingKey_IsAuthError()
    {
        var js = new JsHarness();
        js.Load("gmlab-gemini.js");
        var result = js.Eval("Gmlab.Gemini.complete({ prompt: 'hi' })").UnwrapIfPromise(TimeSpan.FromSeconds(2));
        js.Engine.SetValue("__r", result);
        Assert.StartsWith("auth:", js.EvalString("__r.error"));
    }

    [Fact]
    public void Complete_InvalidKey_IsAuthError_NotCrash()
    {
        using var echo = new EchoServer();
        var js = new JsHarness();
        js.Load("gmlab-gemini.js");
        js.InstallFetch((url, method, headers, body) =>
        {
            using var client = new HttpClient();
            using var req = new HttpRequestMessage(new HttpMethod(method), url);
            foreach (var h in headers)
            {
                if (h.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
                req.Headers.TryAddWithoutValidation(h.Key, h.Value);
            }

            if (!string.IsNullOrEmpty(body))
            {
                req.Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
            }

            using var resp = client.Send(req);
            var text = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return ((int)resp.StatusCode, text);
        });
        js.Engine.SetValue("__endpoint", echo.EchoUrl);
        js.InstallSyncHttpPost();
        var result = js.Eval("""
            Gmlab.Gemini.complete({
              apiKey: 'bad',
              prompt: 'nope',
              endpoint: __endpoint,
              httpPost: function (req) { return __syncHttpPost(req); }
            })
            """).UnwrapIfPromise(TimeSpan.FromSeconds(5));
        js.Engine.SetValue("__r", result);
        Assert.StartsWith("auth:", js.EvalString("__r.error"));
    }
}
