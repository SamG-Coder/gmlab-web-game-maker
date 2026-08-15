(function (root) {
  "use strict";
  var G = (root.Gmlab = root.Gmlab || {});
  G.Editors = G.Editors || {};

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  G.Editors.room = {
    id: "room",
    title: "Room Editor",
    render: function (host, ctx) {
      var project = ctx.project;
      var room = ctx.resource;
      if (!room) {
        host.innerHTML = "<p class='empty'>Select or create a room.</p>";
        return;
      }
      var selectedObjectId = project.objects[0] ? project.objects[0].id : null;
      var scale = 1;

      host.innerHTML =
        "<div class='editor room-editor' data-editor='room'>" +
        "<header class='editor-head'><h2>Room: <span class='res-name'></span></h2></header>" +
        "<div class='form-row'>" +
        "<label>Name <input data-f='name' type='text'></label>" +
        "<label>Width <input data-f='width' type='number' class='num'></label>" +
        "<label>Height <input data-f='height' type='number' class='num'></label>" +
        "<label>Speed <input data-f='speed' type='number' class='num'></label>" +
        "<label class='check'><input data-f='first' type='checkbox'> First room</label>" +
        "</div>" +
        "<div class='form-row'>" +
        "<label>Place object <select data-f='object'></select></label>" +
        "<span class='hint'>Left-click places. Right-click deletes. Snap is 8px.</span>" +
        "</div>" +
        "<div class='room-stage'><canvas class='room-canvas'></canvas></div>" +
        "<div class='instance-list'></div>" +
        "</div>";

      var canvas = host.querySelector(".room-canvas");

      function fillObjectSelect() {
        var sel = host.querySelector("[data-f=object]");
        sel.innerHTML = project.objects.map(function (o) {
          return "<option value='" + o.id + "'" + (o.id === selectedObjectId ? " selected" : "") + ">" + escape(o.name) + "</option>";
        }).join("") || "<option value=''>(create an object first)</option>";
      }

      function sync() {
        room = G.Project.getRoom(project, room.id);
        host.querySelector(".res-name").textContent = room.name;
        host.querySelector("[data-f=name]").value = room.name;
        host.querySelector("[data-f=width]").value = room.width;
        host.querySelector("[data-f=height]").value = room.height;
        host.querySelector("[data-f=speed]").value = room.speed;
        host.querySelector("[data-f=first]").checked = project.firstRoomId === room.id;
        fillObjectSelect();
        host.querySelector(".instance-list").innerHTML = "<h3>Instances (" + room.instances.length + ")</h3><ul>" +
          room.instances.map(function (inst) {
            var o = G.Project.getObject(project, inst.objectId);
            return "<li>" + escape(o ? o.name : inst.objectId) + " @ " + inst.x + "," + inst.y +
              " <button type='button' data-del='" + inst.id + "'>x</button></li>";
          }).join("") + "</ul>";
        host.querySelectorAll("[data-del]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            room.instances = room.instances.filter(function (i) { return i.id !== btn.getAttribute("data-del"); });
            ctx.onChange();
            sync();
            paint();
          });
        });
      }

      function paint() {
        room = G.Project.getRoom(project, room.id);
        var maxW = 640;
        scale = Math.max(0.5, Math.min(2, maxW / room.width));
        canvas.width = Math.floor(room.width * scale);
        canvas.height = Math.floor(room.height * scale);
        var g = canvas.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.fillStyle = "#3a4452";
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = "rgba(255,255,255,0.08)";
        var grid = 16 * scale;
        var x, y;
        g.beginPath();
        for (x = 0; x <= canvas.width; x += grid) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, canvas.height); }
        for (y = 0; y <= canvas.height; y += grid) { g.moveTo(0, y + 0.5); g.lineTo(canvas.width, y + 0.5); }
        g.stroke();
        room.instances.forEach(function (inst) {
          var obj = G.Project.getObject(project, inst.objectId);
          var spr = obj && obj.spriteId ? G.Project.getSprite(project, obj.spriteId) : null;
          var dx = inst.x * scale;
          var dy = inst.y * scale;
          if (spr) {
            dx -= spr.originX * scale;
            dy -= spr.originY * scale;
            g.fillStyle = obj.solid ? "#8a7060" : "#3d8bff";
            g.fillRect(dx, dy, spr.width * scale, spr.height * scale);
          } else {
            g.fillStyle = "#ccc";
            g.fillRect(dx, dy, 16 * scale, 16 * scale);
          }
        });
      }

      function local(ev) {
        var rect = canvas.getBoundingClientRect();
        var x = Math.round((ev.clientX - rect.left) / scale);
        var y = Math.round((ev.clientY - rect.top) / scale);
        x = Math.round(x / 8) * 8;
        y = Math.round(y / 8) * 8;
        return { x: x, y: y };
      }

      canvas.addEventListener("mousedown", function (ev) {
        var p = local(ev);
        if (ev.button === 2 || ev.ctrlKey) {
          var hit = null;
          for (var i = room.instances.length - 1; i >= 0; i--) {
            var inst = room.instances[i];
            if (Math.abs(inst.x - p.x) < 12 && Math.abs(inst.y - p.y) < 12) { hit = inst; break; }
          }
          if (hit) {
            room.instances = room.instances.filter(function (i) { return i.id !== hit.id; });
            ctx.onChange();
            sync();
            paint();
          }
          ev.preventDefault();
          return;
        }
        if (!selectedObjectId) return;
        G.Project.addInstance(project, room.id, { objectId: selectedObjectId, x: p.x, y: p.y });
        ctx.onChange();
        sync();
        paint();
      });
      canvas.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });

      host.querySelector("[data-f=name]").addEventListener("change", function (ev) {
        G.Project.updateRoom(project, room.id, { name: ev.target.value });
        ctx.onChange();
        sync();
      });
      ["width", "height", "speed"].forEach(function (f) {
        host.querySelector("[data-f=" + f + "]").addEventListener("change", function (ev) {
          var patch = {};
          patch[f] = ev.target.value | 0;
          G.Project.updateRoom(project, room.id, patch);
          ctx.onChange();
          sync();
          paint();
        });
      });
      host.querySelector("[data-f=first]").addEventListener("change", function (ev) {
        if (ev.target.checked) G.Project.setFirstRoom(project, room.id);
        ctx.onChange();
      });
      host.querySelector("[data-f=object]").addEventListener("change", function (ev) {
        selectedObjectId = ev.target.value || null;
      });

      sync();
      paint();
    }
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
