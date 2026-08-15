namespace Gmlab.Tests;

public sealed class ExportTests
{
    private static JsHarness Fixture()
    {
        var js = new JsHarness();
        js.LoadEngine();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'ShareMe' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8, originX: 0, originY: 0, fill: 0xFF3D8BFF });
            var obj = Gmlab.Project.addObject(p, {
              name: 'mover', spriteId: spr.id, visible: true, solid: false,
              events: [{ type: 'create', actions: [{ type: 'move_fixed', direction: 0, speed: 3 }] }]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 96, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 8, y: 8 }]
            });
            """);
        return js;
    }

    [Fact]
    public void Export_ProducesStandaloneHtml_ThatBootsFirstRoom_Twice()
    {
        var js = Fixture();
        js.Eval("var html1 = Gmlab.Export.toStandaloneHtml(p);");
        js.Eval("var html2 = Gmlab.Export.toStandaloneHtml(p);");
        Assert.True(js.EvalBool("Gmlab.Export.hasStandaloneShape(html1)"));
        Assert.True(js.EvalBool("Gmlab.Export.hasStandaloneShape(html2)"));
        Assert.Contains("<canvas id=\"game\"", js.EvalString("html1"));
        Assert.DoesNotContain("gmlab-ide", js.EvalString("html1"));
        Assert.DoesNotContain("resource-tree", js.EvalString("html1"));

        js.Eval("""
            var game1 = Gmlab.Export.bootFromHtml(html1);
            var game2 = Gmlab.Export.bootFromHtml(html2);
            Gmlab.Runtime.step(game1);
            Gmlab.Runtime.step(game2);
            """);
        Assert.True(js.EvalNumber("game1.instances.length") >= 1);
        Assert.True(js.EvalNumber("game2.instances.length") >= 1);
        Assert.Equal(11, js.EvalNumber("game1.instances[0].x"));
        Assert.Equal(11, js.EvalNumber("game2.instances[0].x"));
        Assert.True(js.EvalNumber("Gmlab.Runtime.listDrawnInstances(game1).length") >= 1);
    }

    [Fact]
    public void ReadProjectFromHtml_ReturnsShippedModel()
    {
        var js = Fixture();
        js.Eval("""
            var html = Gmlab.Export.toStandaloneHtml(p);
            var extracted = Gmlab.Export.readProjectFromHtml(html);
            """);
        Assert.Equal("ShareMe", js.EvalString("extracted.name"));
        Assert.Equal(1, js.EvalNumber("extracted.sprites.length"));
        Assert.Equal(1, js.EvalNumber("extracted.objects.length"));
        Assert.Equal(1, js.EvalNumber("extracted.rooms.length"));
    }
}
