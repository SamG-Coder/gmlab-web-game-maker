(function (root) {
  "use strict";
  var G = (root.Gmlab = root.Gmlab || {});
  G.Editors = G.Editors || {};

  function cssColor(argb) {
    var c = argb >>> 0;
    var a = (c >>> 24) & 255;
    var r = (c >>> 16) & 255;
    var g = (c >>> 8) & 255;
    var b = c & 255;
    var hex = "#" + [r, g, b].map(function (n) {
      return ("0" + n.toString(16)).slice(-2);
    }).join("");
    return { hex: hex, a: a };
  }

  function parseColor(hex, alpha) {
    var h = String(hex || "#ffffff").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 0;
    var g = parseInt(h.slice(2, 4), 16) || 0;
    var b = parseInt(h.slice(4, 6), 16) || 0;
    var a = alpha == null ? 255 : alpha | 0;
    return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  }

  G.Editors.sprite = {
    id: "sprite",
    title: "Sprite Editor",
    render: function (host, ctx) {
      var project = ctx.project;
      var spr = ctx.resource;
      if (!spr) {
        host.innerHTML = "<p class='empty'>Select or create a sprite.</p>";
        return;
      }
      var frameIndex = 0;
      var scale = Math.max(8, Math.min(20, Math.floor(360 / Math.max(spr.width, spr.height))));
      var tool = "pencil";
      var color = 0xff3d8bff;
      var parsed = cssColor(color);

      host.innerHTML =
        "<div class='editor sprite-editor' data-editor='sprite'>" +
        "<header class='editor-head'><h2>Sprite: <span class='res-name'></span></h2></header>" +
        "<div class='form-row'>" +
        "<label>Name <input data-f='name' type='text'></label>" +
        "<label>W <input data-f='width' type='number' min='1' max='256' class='num'></label>" +
        "<label>H <input data-f='height' type='number' min='1' max='256' class='num'></label>" +
        "<label>Origin X <input data-f='originX' type='number' class='num'></label>" +
        "<label>Origin Y <input data-f='originY' type='number' class='num'></label>" +
        "</div>" +
        "<div class='form-row tools'>" +
        "<button type='button' data-tool='pencil' class='on'>Pencil</button>" +
        "<button type='button' data-tool='eraser'>Eraser</button>" +
        "<label>Color <input data-f='color' type='color'></label>" +
        "<button type='button' data-act='center-origin'>Center origin</button>" +
        "<button type='button' data-act='add-frame'>Add frame</button>" +
        "<span class='frame-label'>Frame <span data-frame>1</span></span>" +
        "<button type='button' data-act='prev-frame'>&lt;</button>" +
        "<button type='button' data-act='next-frame'>&gt;</button>" +
        "</div>" +
        "<div class='sprite-stage'><canvas class='pixel-canvas'></canvas></div>" +
        "<p class='hint'>Click and drag to paint. Shift-click sets the origin. Frames are shown in Play in order.</p>" +
        "</div>";

      var canvas = host.querySelector(".pixel-canvas");
      var nameEl = host.querySelector(".res-name");

      function syncFields() {
        host.querySelector("[data-f=name]").value = spr.name;
        host.querySelector("[data-f=width]").value = spr.width;
        host.querySelector("[data-f=height]").value = spr.height;
        host.querySelector("[data-f=originX]").value = spr.originX;
        host.querySelector("[data-f=originY]").value = spr.originY;
        host.querySelector("[data-f=color]").value = parsed.hex;
        host.querySelector("[data-frame]").textContent = (frameIndex + 1) + " / " + spr.frames.length;
        nameEl.textContent = spr.name;
      }

      function paint() {
        var frame = spr.frames[frameIndex];
        if (!frame) return;
        canvas.width = frame.width * scale;
        canvas.height = frame.height * scale;
        var g = canvas.getContext("2d");
        g.imageSmoothingEnabled = false;
        for (var y = 0; y < frame.height; y++) {
          for (var x = 0; x < frame.width; x++) {
            var pix = frame.pixels[y * frame.width + x] >>> 0;
            var a = (pix >>> 24) & 255;
            if (((x + y) & 1) === 0) g.fillStyle = "#2a2e38";
            else g.fillStyle = "#323744";
            g.fillRect(x * scale, y * scale, scale, scale);
            if (a === 0) continue;
            var col = cssColor(pix);
            g.fillStyle = col.hex;
            g.globalAlpha = col.a / 255;
            g.fillRect(x * scale, y * scale, scale, scale);
            g.globalAlpha = 1;
          }
        }
        g.strokeStyle = "rgba(255,80,80,0.9)";
        g.beginPath();
        g.moveTo(spr.originX * scale, 0);
        g.lineTo(spr.originX * scale, canvas.height);
        g.moveTo(0, spr.originY * scale);
        g.lineTo(canvas.width, spr.originY * scale);
        g.stroke();
      }

      function cell(ev) {
        var rect = canvas.getBoundingClientRect();
        var x = Math.floor((ev.clientX - rect.left) / scale);
        var y = Math.floor((ev.clientY - rect.top) / scale);
        return { x: x, y: y };
      }

      function apply(x, y) {
        var c = tool === "eraser" ? 0x00000000 : color;
        if (G.Project.setPixel(project, spr.id, frameIndex, x, y, c)) {
          ctx.onChange();
          paint();
        }
      }

      var drawing = false;
      canvas.addEventListener("mousedown", function (ev) {
        var c = cell(ev);
        if (ev.shiftKey) {
          G.Project.updateSprite(project, spr.id, { originX: c.x, originY: c.y });
          spr = G.Project.getSprite(project, spr.id);
          ctx.onChange();
          syncFields();
          paint();
          return;
        }
        drawing = true;
        apply(c.x, c.y);
      });
      canvas.addEventListener("mousemove", function (ev) {
        if (!drawing) return;
        var c = cell(ev);
        apply(c.x, c.y);
      });
      canvas.addEventListener("mouseup", function () { drawing = false; });
      canvas.addEventListener("mouseleave", function () { drawing = false; });

      host.querySelectorAll("[data-tool]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          tool = btn.getAttribute("data-tool");
          host.querySelectorAll("[data-tool]").forEach(function (b) { b.classList.toggle("on", b === btn); });
        });
      });

      host.querySelector("[data-f=color]").addEventListener("input", function (ev) {
        color = parseColor(ev.target.value, 255);
        parsed = cssColor(color);
      });

      ["name", "width", "height", "originX", "originY"].forEach(function (field) {
        host.querySelector("[data-f=" + field + "]").addEventListener("change", function (ev) {
          var val = ev.target.value;
          var patch = {};
          patch[field] = field === "name" ? val : (val | 0);
          G.Project.updateSprite(project, spr.id, patch);
          spr = G.Project.getSprite(project, spr.id);
          if (frameIndex >= spr.frames.length) frameIndex = spr.frames.length - 1;
          ctx.onChange();
          syncFields();
          paint();
        });
      });

      host.querySelector("[data-act=center-origin]").addEventListener("click", function () {
        G.Project.updateSprite(project, spr.id, {
          originX: Math.floor(spr.width / 2),
          originY: Math.floor(spr.height / 2)
        });
        spr = G.Project.getSprite(project, spr.id);
        ctx.onChange();
        syncFields();
        paint();
      });
      host.querySelector("[data-act=add-frame]").addEventListener("click", function () {
        G.Project.addFrame(project, spr.id, 0);
        spr = G.Project.getSprite(project, spr.id);
        frameIndex = spr.frames.length - 1;
        ctx.onChange();
        syncFields();
        paint();
      });
      host.querySelector("[data-act=prev-frame]").addEventListener("click", function () {
        frameIndex = (frameIndex + spr.frames.length - 1) % spr.frames.length;
        syncFields();
        paint();
      });
      host.querySelector("[data-act=next-frame]").addEventListener("click", function () {
        frameIndex = (frameIndex + 1) % spr.frames.length;
        syncFields();
        paint();
      });

      syncFields();
      paint();
    }
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
