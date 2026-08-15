namespace Gmlab.Tests;

public sealed class ProjectModelTests
{
    private static JsHarness Engine()
    {
        var js = new JsHarness();
        js.Load("gmlab-project.js");
        return js;
    }

    [Fact]
    public void Create_AndCrud_AllFiveResourceTypes()
    {
        var js = Engine();
        js.Eval("var p = Gmlab.Project.create({ name: 'Lab' })");
        Assert.Equal("Lab", js.EvalString("p.name"));

        js.Eval("""
            var spr = Gmlab.Project.addSprite(p, {
              name: 'hero', width: 16, height: 16, originX: 8, originY: 8
            });
            Gmlab.Project.setPixel(p, spr.id, 0, 0, 0, 0xFF112233);
            """);
        Assert.Equal(8, js.EvalNumber("Gmlab.Project.getSprite(p, spr.id).originX"));
        Assert.Equal(8, js.EvalNumber("Gmlab.Project.getSprite(p, spr.id).originY"));
        Assert.Equal(1, js.EvalNumber("Gmlab.Project.getSprite(p, spr.id).frames.length"));
        Assert.Equal(0xFF112233, (uint)js.EvalNumber("Gmlab.Project.getPixel(p, spr.id, 0, 0, 0)"));

        js.Eval("Gmlab.Project.updateSprite(p, spr.id, { name: 'hero2', originX: 4 })");
        Assert.Equal("hero2", js.EvalString("Gmlab.Project.getSprite(p, spr.id).name"));
        Assert.Equal(4, js.EvalNumber("Gmlab.Project.getSprite(p, spr.id).originX"));
        Assert.Equal(1, js.EvalNumber("Gmlab.Project.listSprites(p).length"));

        js.Eval("""
            var obj = Gmlab.Project.addObject(p, {
              name: 'player',
              spriteId: spr.id,
              visible: true,
              solid: true,
              events: [{
                type: 'create',
                actions: [{ type: 'move_fixed', direction: 0, speed: 4 }]
              }]
            });
            """);
        Assert.Equal("player", js.EvalString("Gmlab.Project.getObject(p, obj.id).name"));
        Assert.True(js.EvalBool("Gmlab.Project.getObject(p, obj.id).solid"));
        Assert.True(js.EvalBool("Gmlab.Project.getObject(p, obj.id).visible"));
        Assert.Equal("create", js.EvalString("Gmlab.Project.getObject(p, obj.id).events[0].type"));
        Assert.Equal("move_fixed", js.EvalString("Gmlab.Project.getObject(p, obj.id).events[0].actions[0].type"));

        js.Eval("Gmlab.Project.updateObject(p, obj.id, { solid: false, name: 'player2' })");
        Assert.False(js.EvalBool("Gmlab.Project.getObject(p, obj.id).solid"));
        Assert.Equal("player2", js.EvalString("Gmlab.Project.getObject(p, obj.id).name"));

        js.Eval("""
            var room = Gmlab.Project.addRoom(p, {
              name: 'start', width: 320, height: 240, speed: 30,
              instances: [{ objectId: obj.id, x: 10, y: 20 }]
            });
            """);
        Assert.Equal(320, js.EvalNumber("Gmlab.Project.getRoom(p, room.id).width"));
        Assert.Equal(1, js.EvalNumber("Gmlab.Project.getRoom(p, room.id).instances.length"));
        Assert.Equal(10, js.EvalNumber("Gmlab.Project.getRoom(p, room.id).instances[0].x"));
        js.Eval("Gmlab.Project.updateRoom(p, room.id, { width: 400, speed: 60 })");
        Assert.Equal(400, js.EvalNumber("Gmlab.Project.getRoom(p, room.id).width"));
        Assert.Equal(60, js.EvalNumber("Gmlab.Project.getRoom(p, room.id).speed"));

        js.Eval("var snd = Gmlab.Project.addSound(p, { name: 'beep', mime: 'audio/wav', data: 'data:audio/wav;base64,AA' })");
        Assert.Equal("beep", js.EvalString("Gmlab.Project.getSound(p, snd.id).name"));
        js.Eval("Gmlab.Project.updateSound(p, snd.id, { name: 'boop', loop: true })");
        Assert.Equal("boop", js.EvalString("Gmlab.Project.getSound(p, snd.id).name"));
        Assert.True(js.EvalBool("Gmlab.Project.getSound(p, snd.id).loop"));

        js.Eval("""
            var path = Gmlab.Project.addPath(p, {
              name: 'patrol',
              closed: false,
              points: [{ x: 0, y: 0, speed: 100 }, { x: 40, y: 0, speed: 100 }]
            });
            """);
        Assert.Equal(2, js.EvalNumber("Gmlab.Project.getPath(p, path.id).points.length"));
        js.Eval("Gmlab.Project.updatePath(p, path.id, { closed: true })");
        Assert.True(js.EvalBool("Gmlab.Project.getPath(p, path.id).closed"));
        js.Eval("Gmlab.Project.addPathPoint(p, path.id, { x: 40, y: 40, speed: 50 })");
        Assert.Equal(3, js.EvalNumber("Gmlab.Project.getPath(p, path.id).points.length"));

        Assert.Equal(1, js.EvalNumber("Gmlab.Project.listObjects(p).length"));
        Assert.Equal(1, js.EvalNumber("Gmlab.Project.listRooms(p).length"));
        Assert.Equal(1, js.EvalNumber("Gmlab.Project.listSounds(p).length"));
        Assert.Equal(1, js.EvalNumber("Gmlab.Project.listPaths(p).length"));
    }

    [Fact]
    public void FromJson_RoundTripsShippedModel()
    {
        var js = Engine();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'R' });
            var s = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8, originX: 1, originY: 2 });
            var raw = Gmlab.Project.toJSON(p);
            var q = Gmlab.Project.fromJSON(raw);
            """);
        Assert.Equal("R", js.EvalString("q.name"));
        Assert.Equal(1, js.EvalNumber("q.sprites[0].originX"));
        Assert.Equal("s", js.EvalString("Gmlab.Project.getSprite(q, s.id).name"));
    }
}
