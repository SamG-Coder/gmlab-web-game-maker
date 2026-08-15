/**
 * Documented events and simple-logic actions (the Gmlab action catalog).
 * The object editor and the runtime dispatcher both read this list.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  var events = [
    {
      id: "create",
      name: "Create",
      description: "Runs once when an instance is created in a room (game start, room change, or create_instance)."
    },
    {
      id: "destroy",
      name: "Destroy",
      description: "Runs when the instance is destroyed, just before it is removed."
    },
    {
      id: "step",
      name: "Step",
      description: "Runs every frame after keyboard events and before movement is applied."
    },
    {
      id: "collision",
      name: "Collision",
      description: "Runs when this instance's sprite box overlaps another instance. If the other object is Solid, this instance is first moved back to its previous position, then the event runs. A non-solid overlap leaves the new position and still runs the event. Set otherObjectId to a specific object, or leave it empty to match any object."
    },
    {
      id: "keyboard",
      name: "Keyboard",
      description: "Runs every frame while the named key is held down. Keys: left, right, up, down, space, enter, shift, a–z, 0–9."
    },
    {
      id: "keypress",
      name: "Key Press",
      description: "Runs once on the frame the named key becomes down."
    },
    {
      id: "keyrelease",
      name: "Key Release",
      description: "Runs once on the frame the named key becomes up."
    },
    {
      id: "draw",
      name: "Draw",
      description: "Runs when the instance is drawn. If an object has no Draw event and Visible is on, the runtime draws its sprite (draw_self)."
    },
    {
      id: "roomstart",
      name: "Room Start",
      description: "Runs for each instance after a room has been entered and Create events have finished."
    },
    {
      id: "roomend",
      name: "Room End",
      description: "Runs for each instance just before the room is left."
    }
  ];

  var actions = [
    {
      id: "move_fixed",
      name: "Move Fixed",
      group: "move",
      description: "Set direction (degrees, 0 = right, 90 = up) and speed in pixels per step. Updates hspeed/vspeed.",
      params: [
        { key: "direction", label: "Direction", type: "number", value: 0 },
        { key: "speed", label: "Speed", type: "number", value: 4 }
      ]
    },
    {
      id: "set_speed",
      name: "Set Speed",
      group: "move",
      description: "Set the instance speed (pixels per step) and recompute hspeed/vspeed from direction.",
      params: [{ key: "speed", label: "Speed", type: "number", value: 0 }]
    },
    {
      id: "set_direction",
      name: "Set Direction",
      group: "move",
      description: "Set direction in degrees (0 = right, 90 = up) and recompute hspeed/vspeed from speed.",
      params: [{ key: "direction", label: "Direction", type: "number", value: 0 }]
    },
    {
      id: "set_hspeed",
      name: "Set Horizontal Speed",
      group: "move",
      description: "Set hspeed and recompute speed/direction.",
      params: [{ key: "hspeed", label: "HSpeed", type: "number", value: 0 }]
    },
    {
      id: "set_vspeed",
      name: "Set Vertical Speed",
      group: "move",
      description: "Set vspeed and recompute speed/direction. Positive is down.",
      params: [{ key: "vspeed", label: "VSpeed", type: "number", value: 0 }]
    },
    {
      id: "jump_to",
      name: "Jump To Position",
      group: "move",
      description: "Set the instance x and y immediately.",
      params: [
        { key: "x", label: "X", type: "number", value: 0 },
        { key: "y", label: "Y", type: "number", value: 0 }
      ]
    },
    {
      id: "create_instance",
      name: "Create Instance",
      group: "objects",
      description: "Create a new instance of an object at (x, y) and run its Create event immediately.",
      params: [
        { key: "objectId", label: "Object", type: "object", value: "" },
        { key: "x", label: "X", type: "number", value: 0 },
        { key: "y", label: "Y", type: "number", value: 0 }
      ]
    },
    {
      id: "destroy_instance",
      name: "Destroy Instance",
      group: "objects",
      description: "Destroy this instance (runs Destroy, then removes it).",
      params: []
    },
    {
      id: "play_sound",
      name: "Play Sound",
      group: "sound",
      description: "Play a sound resource through the runtime sound API.",
      params: [{ key: "soundId", label: "Sound", type: "sound", value: "" }]
    },
    {
      id: "stop_sound",
      name: "Stop Sound",
      group: "sound",
      description: "Stop a sound resource through the runtime sound API.",
      params: [{ key: "soundId", label: "Sound", type: "sound", value: "" }]
    },
    {
      id: "start_path",
      name: "Start Path",
      group: "path",
      description: "Make this instance follow a path. Speed is pixels per step. End action is stop, restart, or reverse. Closed paths wrap from the last point back to the first.",
      params: [
        { key: "pathId", label: "Path", type: "path", value: "" },
        { key: "speed", label: "Speed", type: "number", value: 4 },
        { key: "endAction", label: "At end", type: "select", value: "stop", options: ["stop", "restart", "reverse"] }
      ]
    },
    {
      id: "stop_path",
      name: "Stop Path",
      group: "path",
      description: "Stop following the current path and resume free movement.",
      params: []
    },
    {
      id: "change_room",
      name: "Change Room",
      group: "rooms",
      description: "Leave the current room (Room End) and enter another (Create, Room Start). Queued until the end of the step.",
      params: [{ key: "roomId", label: "Room", type: "room", value: "" }]
    },
    {
      id: "set_variable",
      name: "Set Variable",
      group: "logic",
      description: "Set an instance variable (number or string). Built-ins x, y, speed, direction, hspeed, vspeed, visible, solid are live.",
      params: [
        { key: "name", label: "Name", type: "string", value: "value" },
        { key: "value", label: "Value", type: "string", value: "0" }
      ]
    },
    {
      id: "if_variable",
      name: "If Variable",
      group: "logic",
      description: "Compare an instance variable. If the test is false, the next action is skipped.",
      params: [
        { key: "name", label: "Name", type: "string", value: "value" },
        { key: "op", label: "Op", type: "select", value: "==", options: ["==", "!=", "<", ">", "<=", ">="] },
        { key: "value", label: "Value", type: "string", value: "0" }
      ]
    },
    {
      id: "draw_self",
      name: "Draw Self",
      group: "draw",
      description: "Draw this instance's sprite at (x - originX, y - originY).",
      params: []
    },
    {
      id: "comment",
      name: "Comment",
      group: "logic",
      description: "A no-op note in the action list.",
      params: [{ key: "text", label: "Text", type: "string", value: "" }]
    }
  ];

  function findEvent(id) {
    for (var i = 0; i < events.length; i++) if (events[i].id === id) return events[i];
    return null;
  }

  function findAction(id) {
    for (var i = 0; i < actions.length; i++) if (actions[i].id === id) return actions[i];
    return null;
  }

  function toMarkdown() {
    var lines = [];
    lines.push("# Gmlab events and simple-logic actions");
    lines.push("");
    lines.push("These are the events and actions the runtime actually runs. The object editor builds action lists from this same catalog.");
    lines.push("");
    lines.push("## Events");
    lines.push("");
    for (var i = 0; i < events.length; i++) {
      lines.push("### `" + events[i].id + "` — " + events[i].name);
      lines.push("");
      lines.push(events[i].description);
      lines.push("");
    }
    lines.push("## Actions");
    lines.push("");
    for (var j = 0; j < actions.length; j++) {
      var a = actions[j];
      lines.push("### `" + a.id + "` — " + a.name);
      lines.push("");
      lines.push(a.description);
      if (a.params && a.params.length) {
        lines.push("");
        lines.push("Parameters:");
        lines.push("");
        for (var k = 0; k < a.params.length; k++) {
          var p = a.params[k];
          lines.push("- `" + p.key + "` (" + p.type + "): " + p.label);
        }
      }
      lines.push("");
    }
    lines.push("## Collision rules");
    lines.push("");
    lines.push("- Overlap is axis-aligned using the sprite size and origin.");
    lines.push("- Solid other: mover is restored to the previous position, then the Collision event runs.");
    lines.push("- Non-solid other: position is kept, Collision event still runs.");
    lines.push("");
    lines.push("## Movement");
    lines.push("");
    lines.push("Direction uses Game Maker degrees: 0 right, 90 up, 180 left, 270 down. `hspeed = speed * cos(dir)`, `vspeed = -speed * sin(dir)`.");
    return lines.join("\n");
  }

  G.Docs = {
    events: events,
    actions: actions,
    findEvent: findEvent,
    findAction: findAction,
    toMarkdown: toMarkdown
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
