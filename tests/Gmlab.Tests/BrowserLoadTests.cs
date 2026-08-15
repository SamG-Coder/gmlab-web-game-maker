namespace Gmlab.Tests;

public sealed class BrowserLoadTests
{
    [Theory]
    [MemberData(nameof(ScriptCases))]
    public void EachShippedScript_LoadsInBrowserSandbox_WithoutThrow(string file, string globalPath)
    {
        var js = new JsHarness(browserSandbox: true);
        Assert.True(js.EvalBool("typeof window !== 'undefined'"));
        Assert.True(js.EvalBool("typeof module === 'undefined'"));
        Assert.True(js.EvalBool("typeof require === 'undefined'"));
        Assert.True(js.EvalBool("typeof exports === 'undefined'"));
        js.Load(file);
        Assert.True(js.EvalBool("typeof " + globalPath + " !== 'undefined'"), globalPath + " missing after " + file);
    }

    [Fact]
    public void AllShippedScripts_Together_InstallExpectedGlobals()
    {
        var js = new JsHarness(browserSandbox: true);
        js.LoadAllShipped();
        Assert.True(js.EvalBool("typeof Gmlab.Project.create === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Runtime.step === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Export.toStandaloneHtml === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Share.publish === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Gemini.complete === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Docs.actions !== 'undefined'"));
        Assert.True(js.EvalBool("typeof Gmlab.Editors.sprite.render === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Editors.object.render === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Editors.room.render === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Editors.sound.render === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Editors.path.render === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.IDE.init === 'function'"));
        Assert.True(js.EvalBool("typeof Gmlab.Sample.build === 'function'"));
    }

    public static IEnumerable<object[]> ScriptCases()
    {
        foreach (var kv in JsHarness.ExpectedGlobals)
        {
            yield return [kv.Key, kv.Value];
        }
    }
}
