/**
 * Gmlab project model — sprites, objects, rooms, sounds, paths.
 * Plain script. Installs window.Gmlab.Project. Works in the browser and in tests.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function findById(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function indexOfId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return -1;
  }

  function applyPatch(target, patch) {
    if (!patch) return target;
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key === "id") continue;
      target[key] = patch[key];
    }
    return target;
  }

  function requireProject(project) {
    if (!project || typeof project !== "object") {
      throw new Error("Gmlab.Project: expected a project object");
    }
    if (!project.sprites) project.sprites = [];
    if (!project.objects) project.objects = [];
    if (!project.rooms) project.rooms = [];
    if (!project.sounds) project.sounds = [];
    if (!project.paths) project.paths = [];
    return project;
  }

  function blankFrame(width, height, fill) {
    var w = Math.max(1, width | 0);
    var h = Math.max(1, height | 0);
    var pixels = new Array(w * h);
    var color = fill == null ? 0x00000000 : fill >>> 0;
    for (var i = 0; i < pixels.length; i++) pixels[i] = color;
    return { width: w, height: h, pixels: pixels };
  }

  function normalizeFrame(frame, fallbackW, fallbackH) {
    if (!frame) return blankFrame(fallbackW, fallbackH, 0);
    var w = frame.width != null ? frame.width | 0 : fallbackW;
    var h = frame.height != null ? frame.height | 0 : fallbackH;
    var expected = w * h;
    var pixels = frame.pixels ? frame.pixels.slice() : [];
    while (pixels.length < expected) pixels.push(0);
    if (pixels.length > expected) pixels.length = expected;
    return { width: w, height: h, pixels: pixels };
  }

  var Project = {
    version: 1,

    create: function (opts) {
      opts = opts || {};
      return {
        id: opts.id || uid("proj"),
        name: opts.name || "Game",
        version: 1,
        sprites: [],
        objects: [],
        rooms: [],
        sounds: [],
        paths: [],
        firstRoomId: null
      };
    },

    toJSON: function (project) {
      return JSON.stringify(requireProject(project));
    },

    fromJSON: function (json) {
      var data = typeof json === "string" ? JSON.parse(json) : json;
      return requireProject(data);
    },

    clone: function (project) {
      return clone(requireProject(project));
    },

    /* ---- sprites ---- */

    addSprite: function (project, data) {
      project = requireProject(project);
      data = data || {};
      var width = data.width != null ? data.width | 0 : 16;
      var height = data.height != null ? data.height | 0 : 16;
      var frames;
      if (data.frames && data.frames.length) {
        frames = [];
        for (var i = 0; i < data.frames.length; i++) {
          frames.push(normalizeFrame(data.frames[i], width, height));
        }
        width = frames[0].width;
        height = frames[0].height;
      } else {
        frames = [blankFrame(width, height, data.fill != null ? data.fill : 0x00000000)];
      }
      var sprite = {
        id: data.id || uid("spr"),
        name: data.name || "sprite",
        width: width,
        height: height,
        originX: data.originX != null ? data.originX | 0 : 0,
        originY: data.originY != null ? data.originY | 0 : 0,
        frames: frames
      };
      project.sprites.push(sprite);
      return sprite;
    },

    updateSprite: function (project, id, patch) {
      project = requireProject(project);
      var sprite = findById(project.sprites, id);
      if (!sprite) throw new Error("sprite not found: " + id);
      if (patch && patch.frames) {
        var frames = [];
        for (var i = 0; i < patch.frames.length; i++) {
          frames.push(normalizeFrame(patch.frames[i], sprite.width, sprite.height));
        }
        sprite.frames = frames;
        if (frames[0]) {
          sprite.width = frames[0].width;
          sprite.height = frames[0].height;
        }
        patch = Object.assign({}, patch);
        delete patch.frames;
      }
      if (patch && (patch.width != null || patch.height != null)) {
        var w = patch.width != null ? patch.width | 0 : sprite.width;
        var h = patch.height != null ? patch.height | 0 : sprite.height;
        sprite.width = w;
        sprite.height = h;
        for (var f = 0; f < sprite.frames.length; f++) {
          sprite.frames[f] = normalizeFrame(sprite.frames[f], w, h);
          sprite.frames[f].width = w;
          sprite.frames[f].height = h;
          var expected = w * h;
          while (sprite.frames[f].pixels.length < expected) sprite.frames[f].pixels.push(0);
          if (sprite.frames[f].pixels.length > expected) sprite.frames[f].pixels.length = expected;
        }
        patch = Object.assign({}, patch);
        delete patch.width;
        delete patch.height;
      }
      applyPatch(sprite, patch);
      return sprite;
    },

    getSprite: function (project, id) {
      return findById(requireProject(project).sprites, id);
    },

    listSprites: function (project) {
      return requireProject(project).sprites.slice();
    },

    removeSprite: function (project, id) {
      project = requireProject(project);
      var idx = indexOfId(project.sprites, id);
      if (idx < 0) return false;
      project.sprites.splice(idx, 1);
      return true;
    },

    setPixel: function (project, spriteId, frameIndex, x, y, color) {
      var sprite = Project.getSprite(project, spriteId);
      if (!sprite) throw new Error("sprite not found: " + spriteId);
      var frame = sprite.frames[frameIndex | 0];
      if (!frame) throw new Error("frame not found: " + frameIndex);
      if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return false;
      frame.pixels[y * frame.width + x] = color >>> 0;
      return true;
    },

    getPixel: function (project, spriteId, frameIndex, x, y) {
      var sprite = Project.getSprite(project, spriteId);
      if (!sprite) return 0;
      var frame = sprite.frames[frameIndex | 0];
      if (!frame || x < 0 || y < 0 || x >= frame.width || y >= frame.height) return 0;
      return frame.pixels[y * frame.width + x] >>> 0;
    },

    fillSpriteRect: function (project, spriteId, frameIndex, x, y, w, h, color) {
      for (var iy = 0; iy < h; iy++) {
        for (var ix = 0; ix < w; ix++) {
          Project.setPixel(project, spriteId, frameIndex, x + ix, y + iy, color);
        }
      }
    },

    addFrame: function (project, spriteId, fill) {
      var sprite = Project.getSprite(project, spriteId);
      if (!sprite) throw new Error("sprite not found: " + spriteId);
      var frame = blankFrame(sprite.width, sprite.height, fill);
      sprite.frames.push(frame);
      return frame;
    },

    /* ---- objects ---- */

    addObject: function (project, data) {
      project = requireProject(project);
      data = data || {};
      var obj = {
        id: data.id || uid("obj"),
        name: data.name || "object",
        spriteId: data.spriteId || null,
        visible: data.visible !== false,
        solid: !!data.solid,
        events: normalizeEvents(data.events)
      };
      project.objects.push(obj);
      return obj;
    },

    updateObject: function (project, id, patch) {
      project = requireProject(project);
      var obj = findById(project.objects, id);
      if (!obj) throw new Error("object not found: " + id);
      if (patch && patch.events) {
        obj.events = normalizeEvents(patch.events);
        patch = Object.assign({}, patch);
        delete patch.events;
      }
      applyPatch(obj, patch);
      return obj;
    },

    getObject: function (project, id) {
      return findById(requireProject(project).objects, id);
    },

    listObjects: function (project) {
      return requireProject(project).objects.slice();
    },

    removeObject: function (project, id) {
      project = requireProject(project);
      var idx = indexOfId(project.objects, id);
      if (idx < 0) return false;
      project.objects.splice(idx, 1);
      return true;
    },

    addEvent: function (project, objectId, eventData) {
      var obj = Project.getObject(project, objectId);
      if (!obj) throw new Error("object not found: " + objectId);
      var ev = normalizeEvent(eventData || { type: "create" });
      obj.events.push(ev);
      return ev;
    },

    addAction: function (project, objectId, eventIndex, actionData) {
      var obj = Project.getObject(project, objectId);
      if (!obj) throw new Error("object not found: " + objectId);
      var ev = obj.events[eventIndex | 0];
      if (!ev) throw new Error("event not found: " + eventIndex);
      var action = normalizeAction(actionData || { type: "comment", text: "" });
      ev.actions.push(action);
      return action;
    },

    /* ---- rooms ---- */

    addRoom: function (project, data) {
      project = requireProject(project);
      data = data || {};
      var room = {
        id: data.id || uid("rm"),
        name: data.name || "room",
        width: data.width != null ? data.width | 0 : 640,
        height: data.height != null ? data.height | 0 : 480,
        speed: data.speed != null ? data.speed | 0 : 30,
        color: data.color != null ? data.color >>> 0 : 0xff808080,
        instances: normalizeInstances(data.instances)
      };
      project.rooms.push(room);
      if (!project.firstRoomId) project.firstRoomId = room.id;
      return room;
    },

    updateRoom: function (project, id, patch) {
      project = requireProject(project);
      var room = findById(project.rooms, id);
      if (!room) throw new Error("room not found: " + id);
      if (patch && patch.instances) {
        room.instances = normalizeInstances(patch.instances);
        patch = Object.assign({}, patch);
        delete patch.instances;
      }
      applyPatch(room, patch);
      return room;
    },

    getRoom: function (project, id) {
      return findById(requireProject(project).rooms, id);
    },

    listRooms: function (project) {
      return requireProject(project).rooms.slice();
    },

    removeRoom: function (project, id) {
      project = requireProject(project);
      var idx = indexOfId(project.rooms, id);
      if (idx < 0) return false;
      project.rooms.splice(idx, 1);
      if (project.firstRoomId === id) {
        project.firstRoomId = project.rooms[0] ? project.rooms[0].id : null;
      }
      return true;
    },

    setFirstRoom: function (project, id) {
      project = requireProject(project);
      if (id && !findById(project.rooms, id)) throw new Error("room not found: " + id);
      project.firstRoomId = id || null;
      return project.firstRoomId;
    },

    addInstance: function (project, roomId, data) {
      var room = Project.getRoom(project, roomId);
      if (!room) throw new Error("room not found: " + roomId);
      data = data || {};
      var inst = {
        id: data.id || uid("inst"),
        objectId: data.objectId,
        x: data.x != null ? +data.x : 0,
        y: data.y != null ? +data.y : 0
      };
      room.instances.push(inst);
      return inst;
    },

    /* ---- sounds ---- */

    addSound: function (project, data) {
      project = requireProject(project);
      data = data || {};
      var sound = {
        id: data.id || uid("snd"),
        name: data.name || "sound",
        mime: data.mime || "audio/wav",
        data: data.data || "",
        loop: !!data.loop
      };
      project.sounds.push(sound);
      return sound;
    },

    updateSound: function (project, id, patch) {
      project = requireProject(project);
      var sound = findById(project.sounds, id);
      if (!sound) throw new Error("sound not found: " + id);
      applyPatch(sound, patch);
      return sound;
    },

    getSound: function (project, id) {
      return findById(requireProject(project).sounds, id);
    },

    listSounds: function (project) {
      return requireProject(project).sounds.slice();
    },

    removeSound: function (project, id) {
      project = requireProject(project);
      var idx = indexOfId(project.sounds, id);
      if (idx < 0) return false;
      project.sounds.splice(idx, 1);
      return true;
    },

    /* ---- paths ---- */

    addPath: function (project, data) {
      project = requireProject(project);
      data = data || {};
      var path = {
        id: data.id || uid("pth"),
        name: data.name || "path",
        closed: !!data.closed,
        points: normalizePoints(data.points)
      };
      project.paths.push(path);
      return path;
    },

    updatePath: function (project, id, patch) {
      project = requireProject(project);
      var path = findById(project.paths, id);
      if (!path) throw new Error("path not found: " + id);
      if (patch && patch.points) {
        path.points = normalizePoints(patch.points);
        patch = Object.assign({}, patch);
        delete patch.points;
      }
      applyPatch(path, patch);
      return path;
    },

    getPath: function (project, id) {
      return findById(requireProject(project).paths, id);
    },

    listPaths: function (project) {
      return requireProject(project).paths.slice();
    },

    removePath: function (project, id) {
      project = requireProject(project);
      var idx = indexOfId(project.paths, id);
      if (idx < 0) return false;
      project.paths.splice(idx, 1);
      return true;
    },

    addPathPoint: function (project, pathId, point) {
      var path = Project.getPath(project, pathId);
      if (!path) throw new Error("path not found: " + pathId);
      var pt = {
        x: point && point.x != null ? +point.x : 0,
        y: point && point.y != null ? +point.y : 0,
        speed: point && point.speed != null ? +point.speed : 100
      };
      path.points.push(pt);
      return pt;
    },

    blankFrame: blankFrame
  };

  function normalizeEvents(events) {
    if (!events || !events.length) return [];
    var out = [];
    for (var i = 0; i < events.length; i++) out.push(normalizeEvent(events[i]));
    return out;
  }

  function normalizeEvent(event) {
    event = event || {};
    return {
      id: event.id || uid("ev"),
      type: event.type || "create",
      key: event.key || null,
      otherObjectId: event.otherObjectId || null,
      actions: normalizeActions(event.actions)
    };
  }

  function normalizeActions(actions) {
    if (!actions || !actions.length) return [];
    var out = [];
    for (var i = 0; i < actions.length; i++) out.push(normalizeAction(actions[i]));
    return out;
  }

  function normalizeAction(action) {
    action = action || {};
    var out = { type: action.type || "comment" };
    var keys = Object.keys(action);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = action[keys[i]];
    }
    if (!out.type) out.type = "comment";
    return out;
  }

  function normalizeInstances(instances) {
    if (!instances || !instances.length) return [];
    var out = [];
    for (var i = 0; i < instances.length; i++) {
      var it = instances[i] || {};
      out.push({
        id: it.id || uid("inst"),
        objectId: it.objectId,
        x: it.x != null ? +it.x : 0,
        y: it.y != null ? +it.y : 0
      });
    }
    return out;
  }

  function normalizePoints(points) {
    if (!points || !points.length) return [];
    var out = [];
    for (var i = 0; i < points.length; i++) {
      var pt = points[i] || {};
      out.push({
        x: pt.x != null ? +pt.x : 0,
        y: pt.y != null ? +pt.y : 0,
        speed: pt.speed != null ? +pt.speed : 100
      });
    }
    return out;
  }

  G.Project = Project;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
