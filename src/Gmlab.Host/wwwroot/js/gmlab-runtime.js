/**
 * Gmlab runtime — events, movement, solid/non-solid collision, paths, sounds, rooms.
 * No DOM required. Draw uses an optional canvas-like context.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function syncFromPolar(inst) {
    var rad = degToRad(inst.direction);
    inst.hspeed = inst.speed * Math.cos(rad);
    inst.vspeed = -inst.speed * Math.sin(rad);
  }

  function syncFromCartesian(inst) {
    inst.speed = Math.sqrt(inst.hspeed * inst.hspeed + inst.vspeed * inst.vspeed);
    if (inst.speed === 0) return;
    inst.direction = (Math.atan2(-inst.vspeed, inst.hspeed) * 180) / Math.PI;
  }

  function parseValue(raw) {
    if (typeof raw === "number") return raw;
    if (typeof raw === "boolean") return raw;
    if (raw == null) return 0;
    var s = String(raw);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s !== "" && !isNaN(Number(s))) return Number(s);
    return s;
  }

  function getVar(inst, name) {
    if (Object.prototype.hasOwnProperty.call(inst, name)) return inst[name];
    if (inst.vars && Object.prototype.hasOwnProperty.call(inst.vars, name)) return inst.vars[name];
    return 0;
  }

  function setVar(inst, name, value) {
    var v = parseValue(value);
    if (name === "x" || name === "y" || name === "speed" || name === "direction" ||
        name === "hspeed" || name === "vspeed") {
      inst[name] = +v;
      if (name === "speed" || name === "direction") syncFromPolar(inst);
      if (name === "hspeed" || name === "vspeed") syncFromCartesian(inst);
      return;
    }
    if (name === "visible" || name === "solid") {
      inst[name] = !!v;
      return;
    }
    inst.vars[name] = v;
  }

  function spriteOf(game, object) {
    if (!object || !object.spriteId) return null;
    return G.Project.getSprite(game.project, object.spriteId);
  }

  function aabb(game, inst) {
    var spr = spriteOf(game, inst.object);
    var w = spr ? spr.width : 16;
    var h = spr ? spr.height : 16;
    var ox = spr ? spr.originX : 0;
    var oy = spr ? spr.originY : 0;
    return {
      l: inst.x - ox,
      t: inst.y - oy,
      r: inst.x - ox + w,
      b: inst.y - oy + h
    };
  }

  function overlaps(a, b) {
    return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  }

  function logEvent(game, type, inst, extra) {
    var entry = { type: type, instanceId: inst.id, objectId: inst.objectId };
    if (extra) {
      var keys = Object.keys(extra);
      for (var i = 0; i < keys.length; i++) entry[keys[i]] = extra[keys[i]];
    }
    game.eventLog.push(entry);
  }

  function instancesAlive(game) {
    var out = [];
    for (var i = 0; i < game.instances.length; i++) {
      if (!game.instances[i].destroyed) out.push(game.instances[i]);
    }
    return out;
  }

  function spawn(game, objectId, x, y, runCreate) {
    var object = G.Project.getObject(game.project, objectId);
    if (!object) throw new Error("object not found: " + objectId);
    game.instanceSeq += 1;
    var inst = {
      id: "live_" + game.instanceSeq,
      objectId: objectId,
      object: object,
      x: +x || 0,
      y: +y || 0,
      speed: 0,
      direction: 0,
      hspeed: 0,
      vspeed: 0,
      visible: object.visible !== false,
      solid: !!object.solid,
      destroyed: false,
      imageIndex: 0,
      pathActive: false,
      pathId: null,
      pathSpeed: 0,
      pathPoint: 0,
      pathT: 0,
      pathDir: 1,
      pathEndAction: "stop",
      vars: {}
    };
    game.instances.push(inst);
    if (runCreate !== false) {
      runEvents(game, inst, "create");
    }
    return inst;
  }

  function destroyInstance(game, inst) {
    if (!inst || inst.destroyed) return;
    runEvents(game, inst, "destroy");
    inst.destroyed = true;
  }

  function sweepDestroyed(game) {
    var kept = [];
    for (var i = 0; i < game.instances.length; i++) {
      if (!game.instances[i].destroyed) kept.push(game.instances[i]);
    }
    game.instances = kept;
  }

  function eventsOfType(object, type) {
    var out = [];
    var events = object.events || [];
    for (var i = 0; i < events.length; i++) {
      if (events[i].type === type) out.push(events[i]);
    }
    return out;
  }

  function runEvents(game, inst, type, filter) {
    if (!inst || inst.destroyed) return;
    var list = eventsOfType(inst.object, type);
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (filter && !filter(ev)) continue;
      logEvent(game, type, inst, {
        key: ev.key || null,
        otherObjectId: ev.otherObjectId || null
      });
      runActions(game, inst, ev.actions || []);
    }
  }

  function runActions(game, inst, actions) {
    var skip = false;
    for (var i = 0; i < actions.length; i++) {
      if (skip) {
        skip = false;
        continue;
      }
      var result = Actions.execute(game, inst, actions[i]);
      if (result && result.skipNext) skip = true;
      if (inst.destroyed) return;
    }
  }

  function playSound(game, soundId) {
    game.soundLog.push({ op: "play", id: soundId });
    if (game.soundApi && typeof game.soundApi.play === "function") {
      game.soundApi.play(soundId, G.Project.getSound(game.project, soundId));
    }
  }

  function stopSound(game, soundId) {
    game.soundLog.push({ op: "stop", id: soundId });
    if (game.soundApi && typeof game.soundApi.stop === "function") {
      game.soundApi.stop(soundId, G.Project.getSound(game.project, soundId));
    }
  }

  function startPath(game, inst, pathId, speed, endAction) {
    var path = G.Project.getPath(game.project, pathId);
    if (!path || !path.points || path.points.length === 0) return;
    inst.pathActive = true;
    inst.pathId = pathId;
    inst.pathSpeed = speed != null ? +speed : 4;
    inst.pathEndAction = endAction || "stop";
    inst.pathPoint = 0;
    inst.pathT = 0;
    inst.pathDir = 1;
    inst.x = path.points[0].x;
    inst.y = path.points[0].y;
  }

  function advancePath(game, inst) {
    if (!inst.pathActive) return;
    var path = G.Project.getPath(game.project, inst.pathId);
    if (!path || !path.points || path.points.length === 0) {
      inst.pathActive = false;
      return;
    }
    var pts = path.points;
    if (pts.length === 1) {
      inst.x = pts[0].x;
      inst.y = pts[0].y;
      return;
    }

    var remaining = inst.pathSpeed;
    var guard = 0;
    while (remaining > 0 && inst.pathActive && guard++ < 64) {
      var i0 = inst.pathPoint;
      var i1 = i0 + inst.pathDir;
      if (i1 >= pts.length) {
        if (path.closed) {
          i1 = 0;
        } else if (inst.pathEndAction === "restart") {
          inst.pathPoint = 0;
          inst.pathT = 0;
          inst.pathDir = 1;
          inst.x = pts[0].x;
          inst.y = pts[0].y;
          continue;
        } else if (inst.pathEndAction === "reverse") {
          inst.pathDir = -1;
          i1 = i0 + inst.pathDir;
        } else {
          inst.x = pts[pts.length - 1].x;
          inst.y = pts[pts.length - 1].y;
          inst.pathActive = false;
          break;
        }
      }
      if (i1 < 0) {
        if (path.closed) {
          i1 = pts.length - 1;
        } else if (inst.pathEndAction === "restart") {
          inst.pathPoint = 0;
          inst.pathT = 0;
          inst.pathDir = 1;
          continue;
        } else if (inst.pathEndAction === "reverse") {
          inst.pathDir = 1;
          i1 = i0 + inst.pathDir;
        } else {
          inst.x = pts[0].x;
          inst.y = pts[0].y;
          inst.pathActive = false;
          break;
        }
      }
      var a = pts[i0];
      var b = pts[i1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 0.0001) {
        inst.pathPoint = i1;
        inst.pathT = 0;
        continue;
      }
      var distLeft = (1 - inst.pathT) * segLen;
      if (remaining >= distLeft) {
        remaining -= distLeft;
        inst.pathPoint = i1;
        inst.pathT = 0;
        inst.x = b.x;
        inst.y = b.y;
      } else {
        inst.pathT += remaining / segLen;
        inst.x = a.x + dx * inst.pathT;
        inst.y = a.y + dy * inst.pathT;
        remaining = 0;
      }
    }
  }

  function enterRoom(game, roomId) {
    var room = roomId ? G.Project.getRoom(game.project, roomId) : null;
    if (!room) {
      var firstId = game.project.firstRoomId;
      room = firstId ? G.Project.getRoom(game.project, firstId) : null;
      if (!room && game.project.rooms.length) room = game.project.rooms[0];
    }
    if (!room) {
      game.room = null;
      game.instances = [];
      return;
    }
    if (game.room) {
      var leaving = instancesAlive(game);
      for (var e = 0; e < leaving.length; e++) runEvents(game, leaving[e], "roomend");
    }
    game.room = room;
    game.instances = [];
    for (var i = 0; i < room.instances.length; i++) {
      var place = room.instances[i];
      spawn(game, place.objectId, place.x, place.y, true);
    }
    var started = instancesAlive(game);
    for (var s = 0; s < started.length; s++) runEvents(game, started[s], "roomstart");
    sweepDestroyed(game);
  }

  function applyMovementAndCollisions(game) {
    var list = instancesAlive(game);
    for (var i = 0; i < list.length; i++) {
      var inst = list[i];
      if (inst.destroyed) continue;
      var prevX = inst.x;
      var prevY = inst.y;

      if (inst.pathActive) {
        advancePath(game, inst);
      } else {
        inst.x += inst.hspeed;
        inst.y += inst.vspeed;
      }

      var hits = [];
      var others = instancesAlive(game);
      for (var j = 0; j < others.length; j++) {
        var other = others[j];
        if (other.id === inst.id || other.destroyed) continue;
        if (overlaps(aabb(game, inst), aabb(game, other))) hits.push(other);
      }

      var anySolid = false;
      for (var h = 0; h < hits.length; h++) {
        if (hits[h].solid) anySolid = true;
      }
      if (anySolid) {
        inst.x = prevX;
        inst.y = prevY;
      }

      for (var c = 0; c < hits.length; c++) {
        (function (other) {
          runEvents(game, inst, "collision", function (ev) {
            return !ev.otherObjectId || ev.otherObjectId === other.objectId;
          });
        })(hits[c]);
      }
    }
  }

  function keyDown(game, key) {
    if (!key) return false;
    var k = String(key).toLowerCase();
    return !!(game.keysDown && game.keysDown[k]);
  }

  function runKeyboard(game) {
    var list = instancesAlive(game);
    for (var i = 0; i < list.length; i++) {
      var inst = list[i];
      runEvents(game, inst, "keyboard", function (ev) {
        return keyDown(game, ev.key);
      });
      runEvents(game, inst, "keypress", function (ev) {
        var k = ev.key && String(ev.key).toLowerCase();
        return !!(k && game.keysPressed && game.keysPressed[k]);
      });
      runEvents(game, inst, "keyrelease", function (ev) {
        var k = ev.key && String(ev.key).toLowerCase();
        return !!(k && game.keysReleased && game.keysReleased[k]);
      });
    }
  }

  var Actions = {
    execute: function (game, inst, action) {
      if (!action || !action.type) return null;
      var type = action.type;
      game.actionLog.push({ type: type, instanceId: inst.id });
      switch (type) {
        case "move_fixed":
          inst.direction = +action.direction || 0;
          inst.speed = +action.speed || 0;
          syncFromPolar(inst);
          return null;
        case "set_speed":
          inst.speed = +action.speed || 0;
          syncFromPolar(inst);
          return null;
        case "set_direction":
          inst.direction = +action.direction || 0;
          syncFromPolar(inst);
          return null;
        case "set_hspeed":
          inst.hspeed = +action.hspeed || 0;
          syncFromCartesian(inst);
          return null;
        case "set_vspeed":
          inst.vspeed = +action.vspeed || 0;
          syncFromCartesian(inst);
          return null;
        case "jump_to":
          inst.x = +action.x || 0;
          inst.y = +action.y || 0;
          return null;
        case "create_instance":
          spawn(game, action.objectId, action.x, action.y, true);
          return null;
        case "destroy_instance":
          destroyInstance(game, inst);
          return null;
        case "play_sound":
          playSound(game, action.soundId);
          return null;
        case "stop_sound":
          stopSound(game, action.soundId);
          return null;
        case "start_path":
          startPath(game, inst, action.pathId, action.speed, action.endAction);
          return null;
        case "stop_path":
          inst.pathActive = false;
          return null;
        case "change_room":
          game.pendingRoomId = action.roomId;
          return null;
        case "set_variable":
          setVar(inst, action.name, action.value);
          return null;
        case "if_variable":
          return { skipNext: !compareVar(inst, action.name, action.op, action.value) };
        case "draw_self":
          game.drawList.push({ instanceId: inst.id, kind: "sprite" });
          return null;
        case "comment":
          return null;
        default:
          game.actionLog.push({ type: "unknown", unknown: type, instanceId: inst.id });
          return null;
      }
    }
  };

  function compareVar(inst, name, op, value) {
    var left = getVar(inst, name);
    var right = parseValue(value);
    switch (op) {
      case "!=": return left != right;
      case "<": return +left < +right;
      case ">": return +left > +right;
      case "<=": return +left <= +right;
      case ">=": return +left >= +right;
      default: return left == right;
    }
  }

  function argbToCss(color) {
    var c = color >>> 0;
    var a = (c >>> 24) & 255;
    var r = (c >>> 16) & 255;
    var g = (c >>> 8) & 255;
    var b = c & 255;
    if (a === 255) return "rgb(" + r + "," + g + "," + b + ")";
    return "rgba(" + r + "," + g + "," + b + "," + (a / 255) + ")";
  }

  function drawSpriteFrame(ctx, sprite, frame, dx, dy) {
    if (!ctx || !sprite || !frame) return;
    if (typeof ctx.putImageData === "function" && typeof ctx.createImageData === "function") {
      try {
        var img = ctx.createImageData(frame.width, frame.height);
        for (var i = 0; i < frame.pixels.length; i++) {
          var p = frame.pixels[i] >>> 0;
          img.data[i * 4] = (p >>> 16) & 255;
          img.data[i * 4 + 1] = (p >>> 8) & 255;
          img.data[i * 4 + 2] = p & 255;
          img.data[i * 4 + 3] = (p >>> 24) & 255;
        }
        ctx.putImageData(img, dx, dy);
        return;
      } catch (e) {
        /* fall through to rect */
      }
    }
    ctx.fillStyle = "#3d8bff";
    ctx.fillRect(dx, dy, sprite.width, sprite.height);
  }

  function defaultDraw(game, inst) {
    if (!inst.visible) return;
    game.drawList.push({
      instanceId: inst.id,
      objectId: inst.objectId,
      x: inst.x,
      y: inst.y,
      kind: "sprite"
    });
  }

  var Runtime = {
    Actions: Actions,

    create: function (project, options) {
      options = options || {};
      var game = {
        project: G.Project.clone(project),
        room: null,
        instances: [],
        instanceSeq: 0,
        eventLog: [],
        actionLog: [],
        soundLog: [],
        drawList: [],
        keysDown: {},
        keysPressed: {},
        keysReleased: {},
        prevKeys: {},
        soundApi: options.soundApi || null,
        pendingRoomId: null,
        running: false,
        tick: 0
      };
      return game;
    },

    start: function (game, roomId) {
      game.eventLog = [];
      game.actionLog = [];
      game.soundLog = [];
      game.drawList = [];
      game.pendingRoomId = null;
      game.tick = 0;
      game.running = true;
      enterRoom(game, roomId || game.project.firstRoomId);
      Runtime.collectDraw(game);
      return game;
    },

    setKey: function (game, key, down) {
      if (!key) return;
      var k = String(key).toLowerCase();
      if (down) game.keysDown[k] = true;
      else delete game.keysDown[k];
    },

    step: function (game) {
      if (!game.running) return game;
      game.tick += 1;
      game.drawList = [];

      game.keysPressed = {};
      game.keysReleased = {};
      var seen = {};
      var names = Object.keys(game.keysDown);
      var prev = game.prevKeys || {};
      var i;
      for (i = 0; i < names.length; i++) {
        seen[names[i]] = true;
        if (!prev[names[i]]) game.keysPressed[names[i]] = true;
      }
      var prevNames = Object.keys(prev);
      for (i = 0; i < prevNames.length; i++) {
        if (!game.keysDown[prevNames[i]]) game.keysReleased[prevNames[i]] = true;
      }

      runKeyboard(game);
      var list = instancesAlive(game);
      for (i = 0; i < list.length; i++) runEvents(game, list[i], "step");
      applyMovementAndCollisions(game);

      if (game.pendingRoomId) {
        var next = game.pendingRoomId;
        game.pendingRoomId = null;
        enterRoom(game, next);
      }

      sweepDestroyed(game);
      game.prevKeys = {};
      var now = Object.keys(game.keysDown);
      for (i = 0; i < now.length; i++) game.prevKeys[now[i]] = true;
      Runtime.collectDraw(game);
      return game;
    },

    collectDraw: function (game) {
      game.drawList = [];
      var list = instancesAlive(game);
      for (var i = 0; i < list.length; i++) {
        var inst = list[i];
        var draws = eventsOfType(inst.object, "draw");
        if (draws.length) {
          runEvents(game, inst, "draw");
        } else {
          defaultDraw(game, inst);
        }
      }
      return game.drawList;
    },

    draw: function (game, ctx) {
      var list = Runtime.collectDraw(game);
      if (!ctx) return list;
      var room = game.room;
      var w = room ? room.width : 640;
      var h = room ? room.height : 480;
      if (typeof ctx.clearRect === "function") ctx.clearRect(0, 0, w, h);
      if (room) {
        ctx.fillStyle = argbToCss(room.color != null ? room.color : 0xff808080);
        if (typeof ctx.fillRect === "function") ctx.fillRect(0, 0, w, h);
      }
      for (var i = 0; i < game.instances.length; i++) {
        var inst = game.instances[i];
        if (inst.destroyed || !inst.visible) continue;
        var spr = spriteOf(game, inst.object);
        if (!spr || !spr.frames.length) {
          if (typeof ctx.fillRect === "function") {
            ctx.fillStyle = "#cccccc";
            ctx.fillRect(inst.x, inst.y, 16, 16);
          }
          continue;
        }
        var frame = spr.frames[inst.imageIndex % spr.frames.length];
        drawSpriteFrame(ctx, spr, frame, inst.x - spr.originX, inst.y - spr.originY);
      }
      return list;
    },

    listDrawnInstances: function (game) {
      if (!game.drawList || !game.drawList.length) Runtime.collectDraw(game);
      return game.drawList.slice();
    },

    getInstance: function (game, id) {
      for (var i = 0; i < game.instances.length; i++) {
        if (game.instances[i].id === id) return game.instances[i];
      }
      return null;
    },

    instancesOf: function (game, objectId) {
      var out = [];
      for (var i = 0; i < game.instances.length; i++) {
        if (!game.instances[i].destroyed && game.instances[i].objectId === objectId) {
          out.push(game.instances[i]);
        }
      }
      return out;
    },

    enterRoom: enterRoom,
    spawn: spawn
  };

  G.Runtime = Runtime;
  G.Actions = Actions;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
