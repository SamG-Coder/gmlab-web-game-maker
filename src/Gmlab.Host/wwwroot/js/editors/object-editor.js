(function (root) {
  "use strict";
  var G = (root.Gmlab = root.Gmlab || {});
  G.Editors = G.Editors || {};

  function options(list, value, labelFn, idFn) {
    var html = "<option value=''>(none)</option>";
    for (var i = 0; i < list.length; i++) {
      var id = idFn ? idFn(list[i]) : list[i].id;
      var label = labelFn ? labelFn(list[i]) : list[i].name;
      html += "<option value='" + id + "'" + (id === value ? " selected" : "") + ">" + escape(label) + "</option>";
    }
    return html;
  }

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function defaultAction(type) {
    var spec = G.Docs.findAction(type) || { id: type, params: [] };
    var action = { type: spec.id };
    (spec.params || []).forEach(function (p) { action[p.key] = p.value; });
    return action;
  }

  G.Editors.object = {
    id: "object",
    title: "Object Editor",
    render: function (host, ctx) {
      var project = ctx.project;
      var obj = ctx.resource;
      if (!obj) {
        host.innerHTML = "<p class='empty'>Select or create an object.</p>";
        return;
      }
      var selectedEvent = 0;

      function specInput(param, action, idx) {
        var val = action[param.key] != null ? action[param.key] : param.value;
        var name = "act-" + idx + "-" + param.key;
        if (param.type === "object") {
          return "<label>" + escape(param.label) + " <select data-ak='" + param.key + "' data-ai='" + idx + "'>" +
            options(project.objects, val) + "</select></label>";
        }
        if (param.type === "sound") {
          return "<label>" + escape(param.label) + " <select data-ak='" + param.key + "' data-ai='" + idx + "'>" +
            options(project.sounds, val) + "</select></label>";
        }
        if (param.type === "path") {
          return "<label>" + escape(param.label) + " <select data-ak='" + param.key + "' data-ai='" + idx + "'>" +
            options(project.paths, val) + "</select></label>";
        }
        if (param.type === "room") {
          return "<label>" + escape(param.label) + " <select data-ak='" + param.key + "' data-ai='" + idx + "'>" +
            options(project.rooms, val) + "</select></label>";
        }
        if (param.type === "select") {
          var opts = (param.options || []).map(function (o) {
            return "<option value='" + o + "'" + (o === val ? " selected" : "") + ">" + o + "</option>";
          }).join("");
          return "<label>" + escape(param.label) + " <select data-ak='" + param.key + "' data-ai='" + idx + "'>" + opts + "</select></label>";
        }
        if (param.type === "number") {
          return "<label>" + escape(param.label) + " <input data-ak='" + param.key + "' data-ai='" + idx + "' type='number' value='" + escape(val) + "' class='num'></label>";
        }
        return "<label>" + escape(param.label) + " <input data-ak='" + param.key + "' data-ai='" + idx + "' type='text' value='" + escape(val) + "'" + (name ? "" : "") + "></label>";
      }

      function render() {
        obj = G.Project.getObject(project, obj.id);
        var ev = obj.events[selectedEvent] || null;
        var eventOpts = G.Docs.events.map(function (e) {
          return "<option value='" + e.id + "'>" + e.name + "</option>";
        }).join("");
        var actionOpts = G.Docs.actions.map(function (a) {
          return "<option value='" + a.id + "'>" + a.name + "</option>";
        }).join("");

        var evList = obj.events.map(function (e, i) {
          var spec = G.Docs.findEvent(e.type);
          var extra = "";
          if (e.type === "keyboard" || e.type === "keypress" || e.type === "keyrelease") extra = " [" + (e.key || "?") + "]";
          if (e.type === "collision") {
            var other = e.otherObjectId ? G.Project.getObject(project, e.otherObjectId) : null;
            extra = " with " + (other ? other.name : (e.otherObjectId || "any"));
          }
          return "<button type='button' class='event-item" + (i === selectedEvent ? " on" : "") + "' data-ev='" + i + "'>" +
            escape((spec && spec.name) || e.type) + extra + "</button>";
        }).join("");

        var actionHtml = "";
        if (ev) {
          actionHtml = ev.actions.map(function (action, i) {
            var spec = G.Docs.findAction(action.type);
            var params = (spec && spec.params) || [];
            var fields = params.map(function (p) { return specInput(p, action, i); }).join("");
            return "<div class='action-row' data-ai='" + i + "'>" +
              "<div class='action-title'><strong>" + escape((spec && spec.name) || action.type) + "</strong>" +
              "<button type='button' data-del-act='" + i + "'>Remove</button></div>" +
              "<div class='action-params'>" + fields + "</div>" +
              (spec ? "<p class='micro'>" + escape(spec.description) + "</p>" : "") +
              "</div>";
          }).join("") || "<p class='empty'>No actions yet — add one below.</p>";
        }

        host.innerHTML =
          "<div class='editor object-editor' data-editor='object'>" +
          "<header class='editor-head'><h2>Object: " + escape(obj.name) + "</h2></header>" +
          "<div class='form-row'>" +
          "<label>Name <input data-f='name' type='text' value='" + escape(obj.name) + "'></label>" +
          "<label>Sprite <select data-f='spriteId'>" + options(project.sprites, obj.spriteId) + "</select></label>" +
          "<label class='check'><input data-f='visible' type='checkbox'" + (obj.visible !== false ? " checked" : "") + "> Visible</label>" +
          "<label class='check'><input data-f='solid' type='checkbox'" + (obj.solid ? " checked" : "") + "> Solid</label>" +
          "</div>" +
          "<div class='split'>" +
          "<section class='event-col'>" +
          "<h3>Events</h3>" +
          "<div class='event-list'>" + evList + "</div>" +
          "<div class='form-row'>" +
          "<select data-new-event>" + eventOpts + "</select>" +
          "<input data-new-key placeholder='key (left, space, a)' class='key-input'>" +
          "<select data-new-other>" + options(project.objects, "") + "</select>" +
          "<button type='button' data-act='add-event'>Add event</button>" +
          (ev ? "<button type='button' data-act='del-event'>Remove event</button>" : "") +
          "</div>" +
          "</section>" +
          "<section class='action-col'>" +
          "<h3>Actions" + (ev ? " — " + escape(ev.type) : "") + "</h3>" +
          "<div class='action-list'>" + actionHtml + "</div>" +
          (ev ? "<div class='form-row'><select data-new-action>" + actionOpts + "</select>" +
            "<button type='button' data-act='add-action'>Add action</button></div>" : "") +
          "</section>" +
          "</div>" +
          "<p class='hint'>Every event and action is documented in the right-hand catalog. Solid objects push movers back; non-solid ones do not.</p>" +
          "</div>";

        bind();
      }

      function bind() {
        host.querySelector("[data-f=name]").addEventListener("change", function (ev) {
          G.Project.updateObject(project, obj.id, { name: ev.target.value });
          ctx.onChange();
          render();
        });
        host.querySelector("[data-f=spriteId]").addEventListener("change", function (ev) {
          G.Project.updateObject(project, obj.id, { spriteId: ev.target.value || null });
          ctx.onChange();
        });
        host.querySelector("[data-f=visible]").addEventListener("change", function (ev) {
          G.Project.updateObject(project, obj.id, { visible: ev.target.checked });
          ctx.onChange();
        });
        host.querySelector("[data-f=solid]").addEventListener("change", function (ev) {
          G.Project.updateObject(project, obj.id, { solid: ev.target.checked });
          ctx.onChange();
        });
        host.querySelectorAll("[data-ev]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            selectedEvent = btn.getAttribute("data-ev") | 0;
            render();
          });
        });
        var addEv = host.querySelector("[data-act=add-event]");
        if (addEv) {
          addEv.addEventListener("click", function () {
            var type = host.querySelector("[data-new-event]").value;
            var key = host.querySelector("[data-new-key]").value || null;
            var other = host.querySelector("[data-new-other]").value || null;
            G.Project.addEvent(project, obj.id, { type: type, key: key, otherObjectId: other, actions: [] });
            selectedEvent = obj.events.length - 1;
            ctx.onChange();
            render();
          });
        }
        var delEv = host.querySelector("[data-act=del-event]");
        if (delEv) {
          delEv.addEventListener("click", function () {
            obj.events.splice(selectedEvent, 1);
            selectedEvent = Math.max(0, selectedEvent - 1);
            ctx.onChange();
            render();
          });
        }
        var addAct = host.querySelector("[data-act=add-action]");
        if (addAct) {
          addAct.addEventListener("click", function () {
            var type = host.querySelector("[data-new-action]").value;
            G.Project.addAction(project, obj.id, selectedEvent, defaultAction(type));
            ctx.onChange();
            render();
          });
        }
        host.querySelectorAll("[data-del-act]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var ev = obj.events[selectedEvent];
            ev.actions.splice(btn.getAttribute("data-del-act") | 0, 1);
            ctx.onChange();
            render();
          });
        });
        host.querySelectorAll("[data-ak]").forEach(function (input) {
          input.addEventListener("change", function () {
            var ai = input.getAttribute("data-ai") | 0;
            var key = input.getAttribute("data-ak");
            var ev = obj.events[selectedEvent];
            var action = ev.actions[ai];
            var spec = G.Docs.findAction(action.type);
            var param = spec && spec.params ? spec.params.filter(function (p) { return p.key === key; })[0] : null;
            var val = input.value;
            if (param && param.type === "number") val = +val;
            action[key] = val;
            ctx.onChange();
          });
        });
      }

      render();
    }
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
