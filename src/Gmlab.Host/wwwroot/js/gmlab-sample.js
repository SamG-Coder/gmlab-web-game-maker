/**
 * Built-in demo project — player, solid wall, coin, path, two rooms, a sound.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  function paintBox(project, spriteId, color, inset) {
    var spr = G.Project.getSprite(project, spriteId);
    var m = inset || 1;
    G.Project.fillSpriteRect(project, spriteId, 0, m, m, spr.width - m * 2, spr.height - m * 2, color);
  }

  function silentWavDataUrl() {
    /* 0.05s of silence, 8-bit mono 8000Hz WAV so export/play has a real sound resource */
    var header = [
      0x52, 0x49, 0x46, 0x46, 0x2c, 0x01, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x40, 0x1f, 0x00, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x01, 0x00, 0x08, 0x00,
      0x64, 0x61, 0x74, 0x61, 0x08, 0x01, 0x00, 0x00
    ];
    var samples = [];
    var i;
    for (i = 0; i < 264; i++) samples.push(128);
    var bytes = header.concat(samples);
    var bin = "";
    for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    if (typeof btoa === "function") {
      return "data:audio/wav;base64," + btoa(bin);
    }
    return "data:audio/wav;base64,UklGRiwBAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAABAAgAZGF0YQgBAAAAAAAAAAAAAAAA";
  }

  G.Sample = {
    build: function () {
      var p = G.Project.create({ name: "Demo — Arrow keys, coin, door" });

      var sprPlayer = G.Project.addSprite(p, { name: "sprPlayer", width: 16, height: 16, originX: 8, originY: 8 });
      paintBox(p, sprPlayer.id, 0xff3d8bff, 1);
      G.Project.fillSpriteRect(p, sprPlayer.id, 0, 5, 4, 2, 2, 0xff101018);
      G.Project.fillSpriteRect(p, sprPlayer.id, 0, 9, 4, 2, 2, 0xff101018);

      var sprWall = G.Project.addSprite(p, { name: "sprWall", width: 16, height: 16, originX: 0, originY: 0 });
      paintBox(p, sprWall.id, 0xff6b5344, 0);
      G.Project.fillSpriteRect(p, sprWall.id, 0, 0, 0, 16, 2, 0xff8a7060);

      var sprCoin = G.Project.addSprite(p, { name: "sprCoin", width: 12, height: 12, originX: 6, originY: 6 });
      paintBox(p, sprCoin.id, 0xffffc857, 1);

      var sprDoor = G.Project.addSprite(p, { name: "sprDoor", width: 16, height: 24, originX: 0, originY: 0 });
      paintBox(p, sprDoor.id, 0xff7d5cff, 1);

      var sprPatrol = G.Project.addSprite(p, { name: "sprPatrol", width: 14, height: 14, originX: 7, originY: 7 });
      paintBox(p, sprPatrol.id, 0xffff5c5c, 1);

      var sndCoin = G.Project.addSound(p, {
        name: "sndCoin",
        mime: "audio/wav",
        data: silentWavDataUrl()
      });

      var path = G.Project.addPath(p, {
        name: "pthPatrol",
        closed: true,
        points: [
          { x: 80, y: 80, speed: 100 },
          { x: 240, y: 80, speed: 100 },
          { x: 240, y: 200, speed: 100 },
          { x: 80, y: 200, speed: 100 }
        ]
      });

      var objPlayer = G.Project.addObject(p, {
        name: "objPlayer",
        spriteId: sprPlayer.id,
        visible: true,
        solid: false,
        events: [
          { type: "keyboard", key: "left", actions: [{ type: "set_hspeed", hspeed: -3 }] },
          { type: "keyboard", key: "right", actions: [{ type: "set_hspeed", hspeed: 3 }] },
          { type: "keyboard", key: "up", actions: [{ type: "set_vspeed", vspeed: -3 }] },
          { type: "keyboard", key: "down", actions: [{ type: "set_vspeed", vspeed: 3 }] },
          { type: "keyrelease", key: "left", actions: [{ type: "set_hspeed", hspeed: 0 }] },
          { type: "keyrelease", key: "right", actions: [{ type: "set_hspeed", hspeed: 0 }] },
          { type: "keyrelease", key: "up", actions: [{ type: "set_vspeed", vspeed: 0 }] },
          { type: "keyrelease", key: "down", actions: [{ type: "set_vspeed", vspeed: 0 }] }
        ]
      });

      var objWall = G.Project.addObject(p, {
        name: "objWall",
        spriteId: sprWall.id,
        visible: true,
        solid: true,
        events: []
      });

      var objCoin = G.Project.addObject(p, {
        name: "objCoin",
        spriteId: sprCoin.id,
        visible: true,
        solid: false,
        events: []
      });

      G.Project.addEvent(p, objPlayer.id, {
        type: "collision",
        otherObjectId: objCoin.id,
        actions: [
          { type: "play_sound", soundId: sndCoin.id }
        ]
      });

      G.Project.addEvent(p, objCoin.id, {
        type: "collision",
        otherObjectId: objPlayer.id,
        actions: [
          { type: "play_sound", soundId: sndCoin.id },
          { type: "destroy_instance" }
        ]
      });

      var objDoor = G.Project.addObject(p, {
        name: "objDoor",
        spriteId: sprDoor.id,
        visible: true,
        solid: false,
        events: []
      });

      var room2 = G.Project.addRoom(p, {
        name: "rmClear",
        width: 320,
        height: 240,
        speed: 30,
        color: 0xff203040
      });

      G.Project.addEvent(p, objDoor.id, {
        type: "collision",
        otherObjectId: objPlayer.id,
        actions: [{ type: "change_room", roomId: room2.id }]
      });

      var objPatrol = G.Project.addObject(p, {
        name: "objPatrol",
        spriteId: sprPatrol.id,
        visible: true,
        solid: false,
        events: [
          {
            type: "create",
            actions: [{ type: "start_path", pathId: path.id, speed: 2, endAction: "restart" }]
          }
        ]
      });

      var room1 = G.Project.addRoom(p, {
        name: "rmStart",
        width: 320,
        height: 240,
        speed: 30,
        color: 0xff2a3340
      });

      G.Project.addInstance(p, room1.id, { objectId: objPlayer.id, x: 40, y: 120 });
      G.Project.addInstance(p, room1.id, { objectId: objCoin.id, x: 160, y: 80 });
      G.Project.addInstance(p, room1.id, { objectId: objDoor.id, x: 280, y: 200 });
      G.Project.addInstance(p, room1.id, { objectId: objPatrol.id, x: 80, y: 80 });

      var wx, wy;
      for (wx = 0; wx < 320; wx += 16) {
        G.Project.addInstance(p, room1.id, { objectId: objWall.id, x: wx, y: 0 });
        G.Project.addInstance(p, room1.id, { objectId: objWall.id, x: wx, y: 224 });
      }
      for (wy = 16; wy < 224; wy += 16) {
        G.Project.addInstance(p, room1.id, { objectId: objWall.id, x: 0, y: wy });
        G.Project.addInstance(p, room1.id, { objectId: objWall.id, x: 304, y: wy });
      }
      for (wx = 96; wx < 192; wx += 16) {
        G.Project.addInstance(p, room1.id, { objectId: objWall.id, x: wx, y: 128 });
      }

      G.Project.addInstance(p, room2.id, { objectId: objPlayer.id, x: 160, y: 120 });
      G.Project.setFirstRoom(p, room1.id);
      return p;
    }
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
