namespace Gmlab.Tests;

public sealed class DocsTests
{
    private static readonly string[] TestedActions =
    [
        "move_fixed", "play_sound", "stop_sound", "start_path", "change_room",
        "set_hspeed", "set_variable", "comment"
    ];

    private static readonly string[] TestedEvents =
    [
        "create", "step", "collision", "keyboard", "draw"
    ];

    [Fact]
    public void ShippedDocs_NameEveryRuntimeTestedActionAndEvent()
    {
        var js = new JsHarness();
        js.Load("gmlab-docs.js");
        var markdown = js.EvalString("Gmlab.Docs.toMarkdown()");
        foreach (var action in TestedActions)
        {
            Assert.True(js.EvalBool($"!!Gmlab.Docs.findAction('{action}')"), "missing action " + action);
            Assert.Contains("`" + action + "`", markdown, StringComparison.Ordinal);
        }

        foreach (var ev in TestedEvents)
        {
            Assert.True(js.EvalBool($"!!Gmlab.Docs.findEvent('{ev}')"), "missing event " + ev);
            Assert.Contains("`" + ev + "`", markdown, StringComparison.Ordinal);
        }

        var repoMd = File.ReadAllText(Path.Combine(JsHarness.FindRepoRoot(), "docs", "events-and-actions.md"));
        foreach (var action in TestedActions)
        {
            Assert.Contains("`" + action + "`", repoMd, StringComparison.Ordinal);
        }
    }
}
