namespace Gmlab.Tests;

public sealed class RuntimeTests
{
    private static JsHarness Load()
    {
        var js = new JsHarness();
        js.LoadEngine();
        return js;
    }

    [Fact]
    public void CreateThenStep_FireInOrder()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'order' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var obj = Gmlab.Project.addObject(p, {
              name: 'o', spriteId: spr.id, visible: true, solid: false,
              events: [
                { type: 'create', actions: [{ type: 'comment', text: 'c' }] },
                { type: 'step', actions: [{ type: 'comment', text: 's' }] }
              ]
            });
            var room = Gmlab.Project.addRoom(p, {
              name: 'r', width: 64, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 0, y: 0 }]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            Gmlab.Runtime.step(game);
            """);
        Assert.Equal("create", js.EvalString("game.eventLog[0].type"));
        Assert.Equal("step", js.EvalString("game.eventLog[1].type"));
        Assert.True(js.EvalNumber("game.eventLog.length") >= 2);
    }

    [Fact]
    public void MoveFixed_ChangesPositionFromSpeedAndDirection()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'move' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var obj = Gmlab.Project.addObject(p, {
              name: 'o', spriteId: spr.id, visible: true, solid: false,
              events: [{ type: 'create', actions: [{ type: 'move_fixed', direction: 0, speed: 5 }] }]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 200, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 10, y: 20 }]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            var beforeX = game.instances[0].x;
            var beforeY = game.instances[0].y;
            Gmlab.Runtime.step(game);
            """);
        Assert.Equal(10, js.EvalNumber("beforeX"));
        Assert.Equal(20, js.EvalNumber("beforeY"));
        Assert.Equal(15, js.EvalNumber("game.instances[0].x"));
        Assert.Equal(20, js.EvalNumber("game.instances[0].y"));
        Assert.Equal(5, js.EvalNumber("game.instances[0].speed"));
        Assert.Equal(0, js.EvalNumber("game.instances[0].direction"));
    }

    [Fact]
    public void SolidCollision_RestoresPositionThenRunsEvent()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'solid' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 16, height: 16, originX: 0, originY: 0 });
            var wall = Gmlab.Project.addObject(p, {
              name: 'wall', spriteId: spr.id, visible: true, solid: true, events: []
            });
            var player = Gmlab.Project.addObject(p, {
              name: 'player', spriteId: spr.id, visible: true, solid: false,
              events: [
                { type: 'create', actions: [{ type: 'move_fixed', direction: 0, speed: 8 }] },
                { type: 'collision', otherObjectId: wall.id, actions: [{ type: 'set_variable', name: 'hit', value: '1' }] }
              ]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 200, height: 64, speed: 30,
              instances: [
                { objectId: player.id, x: 0, y: 0 },
                { objectId: wall.id, x: 16, y: 0 }
              ]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            var mover = Gmlab.Runtime.instancesOf(game, player.id)[0];
            var startX = mover.x;
            Gmlab.Runtime.step(game);
            mover = Gmlab.Runtime.instancesOf(game, player.id)[0];
            """);
        Assert.Equal(0, js.EvalNumber("startX"));
        Assert.Equal(0, js.EvalNumber("mover.x"));
        Assert.Equal(1, js.EvalNumber("mover.vars.hit"));
        Assert.Contains("collision", js.EvalString("game.eventLog.map(function(e){return e.type;}).join(',')"));
    }

    [Fact]
    public void NonSolidCollision_KeepsPositionAndRunsEvent()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'nonsolid' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 16, height: 16, originX: 0, originY: 0 });
            var coin = Gmlab.Project.addObject(p, {
              name: 'coin', spriteId: spr.id, visible: true, solid: false, events: []
            });
            var player = Gmlab.Project.addObject(p, {
              name: 'player', spriteId: spr.id, visible: true, solid: false,
              events: [
                { type: 'create', actions: [{ type: 'move_fixed', direction: 0, speed: 8 }] },
                { type: 'collision', otherObjectId: coin.id, actions: [{ type: 'set_variable', name: 'hit', value: '1' }] }
              ]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 200, height: 64, speed: 30,
              instances: [
                { objectId: player.id, x: 0, y: 0 },
                { objectId: coin.id, x: 16, y: 0 }
              ]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            Gmlab.Runtime.step(game);
            var mover = Gmlab.Runtime.instancesOf(game, player.id)[0];
            """);
        Assert.Equal(8, js.EvalNumber("mover.x"));
        Assert.Equal(1, js.EvalNumber("mover.vars.hit"));
        Assert.Contains("collision", js.EvalString("game.eventLog.map(function(e){return e.type;}).join(',')"));
    }

    [Fact]
    public void StartPath_AdvancesAlongWaypoints()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'path' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var path = Gmlab.Project.addPath(p, {
              name: 'line', closed: false,
              points: [{ x: 0, y: 0, speed: 100 }, { x: 50, y: 0, speed: 100 }]
            });
            var obj = Gmlab.Project.addObject(p, {
              name: 'o', spriteId: spr.id, visible: true, solid: false,
              events: [{ type: 'create', actions: [{ type: 'start_path', pathId: path.id, speed: 10, endAction: 'stop' }] }]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 200, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 99, y: 99 }]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            var afterCreateX = game.instances[0].x;
            var afterCreateY = game.instances[0].y;
            Gmlab.Runtime.step(game);
            """);
        Assert.Equal(0, js.EvalNumber("afterCreateX"));
        Assert.Equal(0, js.EvalNumber("afterCreateY"));
        Assert.Equal(10, js.EvalNumber("game.instances[0].x"));
        Assert.Equal(0, js.EvalNumber("game.instances[0].y"));
        js.Eval("for (var i = 0; i < 5; i++) Gmlab.Runtime.step(game);");
        Assert.Equal(50, js.EvalNumber("game.instances[0].x"));
    }

    [Fact]
    public void PlayAndStopSound_InvokeShippedSoundApi()
    {
        var js = Load();
        js.Eval("""
            var plays = [];
            var stops = [];
            var p = Gmlab.Project.create({ name: 'snd' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var snd = Gmlab.Project.addSound(p, { name: 'beep', data: 'data:audio/wav;base64,AA' });
            var obj = Gmlab.Project.addObject(p, {
              name: 'o', spriteId: spr.id, visible: true, solid: false,
              events: [
                { type: 'create', actions: [{ type: 'play_sound', soundId: snd.id }] },
                { type: 'step', actions: [{ type: 'stop_sound', soundId: snd.id }] }
              ]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 64, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 0, y: 0 }]
            });
            var game = Gmlab.Runtime.create(p, {
              soundApi: {
                play: function (id) { plays.push(id); },
                stop: function (id) { stops.push(id); }
              }
            });
            Gmlab.Runtime.start(game);
            var playsAfterStart = plays.slice();
            Gmlab.Runtime.step(game);
            """);
        Assert.Equal(1, js.EvalNumber("playsAfterStart.length"));
        Assert.Equal(js.EvalString("snd.id"), js.EvalString("playsAfterStart[0]"));
        Assert.Equal(1, js.EvalNumber("stops.length"));
        Assert.Equal(js.EvalString("snd.id"), js.EvalString("stops[0]"));
        Assert.Equal("play", js.EvalString("game.soundLog[0].op"));
        Assert.Equal("stop", js.EvalString("game.soundLog[1].op"));
    }

    [Fact]
    public void KeyboardEvent_FiresWhenKeyMarkedDown()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'keys' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var obj = Gmlab.Project.addObject(p, {
              name: 'o', spriteId: spr.id, visible: true, solid: false,
              events: [{ type: 'keyboard', key: 'left', actions: [{ type: 'set_hspeed', hspeed: -4 }] }]
            });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 200, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 40, y: 10 }]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            Gmlab.Runtime.step(game);
            var xWithoutKey = game.instances[0].x;
            Gmlab.Runtime.setKey(game, 'left', true);
            Gmlab.Runtime.step(game);
            """);
        Assert.Equal(40, js.EvalNumber("xWithoutKey"));
        Assert.Equal(36, js.EvalNumber("game.instances[0].x"));
        Assert.Contains("keyboard", js.EvalString("game.eventLog.map(function(e){return e.type;}).join(',')"));
    }

    [Fact]
    public void ChangeRoom_EntersTargetRoom()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'rooms' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var other = Gmlab.Project.addRoom(p, { name: 'b', width: 80, height: 80, speed: 30 });
            var obj = Gmlab.Project.addObject(p, {
              name: 'o', spriteId: spr.id, visible: true, solid: false,
              events: [{ type: 'create', actions: [{ type: 'change_room', roomId: other.id }] }]
            });
            var first = Gmlab.Project.addRoom(p, {
              name: 'a', width: 64, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 0, y: 0 }]
            });
            Gmlab.Project.setFirstRoom(p, first.id);
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            Gmlab.Runtime.step(game);
            """);
        Assert.Equal(js.EvalString("other.id"), js.EvalString("game.room.id"));
        Assert.Equal("b", js.EvalString("game.room.name"));
    }

    [Fact]
    public void DrawList_ReportsVisibleInstanceAfterStart()
    {
        var js = Load();
        js.Eval("""
            var p = Gmlab.Project.create({ name: 'draw' });
            var spr = Gmlab.Project.addSprite(p, { name: 's', width: 8, height: 8 });
            var obj = Gmlab.Project.addObject(p, { name: 'o', spriteId: spr.id, visible: true, solid: false, events: [] });
            Gmlab.Project.addRoom(p, {
              name: 'r', width: 64, height: 64, speed: 30,
              instances: [{ objectId: obj.id, x: 4, y: 5 }]
            });
            var game = Gmlab.Runtime.create(p);
            Gmlab.Runtime.start(game);
            var drawn = Gmlab.Runtime.listDrawnInstances(game);
            """);
        Assert.True(js.EvalNumber("drawn.length") >= 1);
        Assert.Equal("sprite", js.EvalString("drawn[0].kind"));
    }
}
