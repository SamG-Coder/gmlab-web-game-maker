(function (root) {
  "use strict";
  var G = (root.Gmlab = root.Gmlab || {});
  G.Editors = G.Editors || {};

  G.Editors.path = {
    id: "path",
    title: "Path Editor",
    render: function (host, ctx) {
      var project = ctx.project;
      var path = ctx.resource;
      if (!path) {
        host.innerHTML = "<p class='empty'>Select or create a path.</p>";
        return;
      }
      var drag = -1;
      var scale = 1;
      var viewW = 320;
      var viewH = 240;

      host.innerHTML =
        "<div class='editor path-editor' data-editor='path'>" +
        "<header class='editor-head'><h2>Path: <span class='res-name'></span></h2></header>" +
        "<div class='form-row'>" +
        "<label>Name <input data-f='name' type='text'></label>" +
        "<label class='check'><input data-f='closed' type='checkbox'> Closed</label>" +
        "<button type='button' data-act='clear'>Clear points</button>" +
        "</div>" +
        "<div class='path-stage'><canvas class='path-canvas'></canvas></div>" +
        "<div class='point-list'></div>" +
        "<p class='hint'>Click empty space to add a waypoint. Drag a point to move it. Closed paths wrap; open paths stop (or restart/reverse via Start Path).</p>" +
        "</div>";

      var canvas = host.querySelector(".path-canvas");

      function sync() {
        path = G.Project.getPath(project, path.id);
        host.querySelector(".res-name").textContent = path.name;
        host.querySelector("[data-f=name]").value = path.name;
        host.querySelector("[data-f=closed]").checked = !!path.closed;
        host.querySelector(".point-list").innerHTML = "<ol>" + path.points.map(function (pt, i) {
          return "<li>#" + (i + 1) + " (" + pt.x + ", " + pt.y + ") speed " + pt.speed +
            " <button type='button' data-del='" + i + "'>x</button></li>";
        }).join("") + "</ol>";
        host.querySelectorAll("[data-del]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            path.points.splice(btn.getAttribute("data-del") | 0, 1);
            ctx.onChange();
            sync();
            paint();
          });
        });
      }

      function paint() {
        path = G.Project.getPath(project, path.id);
        scale = 1.5;
        canvas.width = viewW * scale;
        canvas.height = viewH * scale;
        var g = canvas.getContext("2d");
        g.fillStyle = "#243044";
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = "rgba(255,255,255,0.06)";
        g.beginPath();
        var s = 16 * scale;
        for (var x = 0; x <= canvas.width; x += s) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, canvas.height); }
        for (var y = 0; y <= canvas.height; y += s) { g.moveTo(0, y + 0.5); g.lineTo(canvas.width, y + 0.5); }
        g.stroke();
        if (path.points.length) {
          g.strokeStyle = "#7d5cff";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(path.points[0].x * scale, path.points[0].y * scale);
          for (var i = 1; i < path.points.length; i++) {
            g.lineTo(path.points[i].x * scale, path.points[i].y * scale);
          }
          if (path.closed && path.points.length > 1) {
            g.lineTo(path.points[0].x * scale, path.points[0].y * scale);
          }
          g.stroke();
          path.points.forEach(function (pt, i) {
            g.fillStyle = i === 0 ? "#3d8bff" : "#ffc857";
            g.beginPath();
            g.arc(pt.x * scale, pt.y * scale, 6, 0, Math.PI * 2);
            g.fill();
          });
        }
      }

      function local(ev) {
        var rect = canvas.getBoundingClientRect();
        return {
          x: Math.round((ev.clientX - rect.left) / scale),
          y: Math.round((ev.clientY - rect.top) / scale)
        };
      }

      function hitIndex(p) {
        for (var i = 0; i < path.points.length; i++) {
          var dx = path.points[i].x - p.x;
          var dy = path.points[i].y - p.y;
          if (dx * dx + dy * dy <= 64) return i;
        }
        return -1;
      }

      canvas.addEventListener("mousedown", function (ev) {
        var p = local(ev);
        var hi = hitIndex(p);
        if (hi >= 0) {
          drag = hi;
          return;
        }
        G.Project.addPathPoint(project, path.id, { x: p.x, y: p.y, speed: 100 });
        ctx.onChange();
        sync();
        paint();
      });
      canvas.addEventListener("mousemove", function (ev) {
        if (drag < 0) return;
        var p = local(ev);
        path.points[drag].x = p.x;
        path.points[drag].y = p.y;
        ctx.onChange();
        paint();
      });
      canvas.addEventListener("mouseup", function () {
        if (drag >= 0) sync();
        drag = -1;
      });

      host.querySelector("[data-f=name]").addEventListener("change", function (ev) {
        G.Project.updatePath(project, path.id, { name: ev.target.value });
        ctx.onChange();
        sync();
      });
      host.querySelector("[data-f=closed]").addEventListener("change", function (ev) {
        G.Project.updatePath(project, path.id, { closed: ev.target.checked });
        ctx.onChange();
        paint();
      });
      host.querySelector("[data-act=clear]").addEventListener("click", function () {
        G.Project.updatePath(project, path.id, { points: [] });
        ctx.onChange();
        sync();
        paint();
      });

      sync();
      paint();
    }
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
