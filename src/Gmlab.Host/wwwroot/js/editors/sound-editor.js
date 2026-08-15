(function (root) {
  "use strict";
  var G = (root.Gmlab = root.Gmlab || {});
  G.Editors = G.Editors || {};

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  G.Editors.sound = {
    id: "sound",
    title: "Sound Editor",
    render: function (host, ctx) {
      var project = ctx.project;
      var sound = ctx.resource;
      if (!sound) {
        host.innerHTML = "<p class='empty'>Select or create a sound.</p>";
        return;
      }
      host.innerHTML =
        "<div class='editor sound-editor' data-editor='sound'>" +
        "<header class='editor-head'><h2>Sound: " + escape(sound.name) + "</h2></header>" +
        "<div class='form-row'>" +
        "<label>Name <input data-f='name' type='text' value='" + escape(sound.name) + "'></label>" +
        "<label class='check'><input data-f='loop' type='checkbox'" + (sound.loop ? " checked" : "") + "> Loop</label>" +
        "</div>" +
        "<div class='form-row'>" +
        "<label>Import audio <input data-f='file' type='file' accept='audio/*'></label>" +
        "<button type='button' data-act='play'>Play</button>" +
        "<button type='button' data-act='stop'>Stop</button>" +
        "</div>" +
        "<p class='hint'>Sounds are stored in the project as a data URL and travel with HTML export. Use Play Sound / Stop Sound actions on objects.</p>" +
        "<p class='meta'>MIME: <code>" + escape(sound.mime || "") + "</code> · " +
        (sound.data ? Math.round(sound.data.length / 1024) + " KB encoded" : "no sample yet") + "</p>" +
        "</div>";

      var audio = null;
      host.querySelector("[data-f=name]").addEventListener("change", function (ev) {
        G.Project.updateSound(project, sound.id, { name: ev.target.value });
        ctx.onChange();
      });
      host.querySelector("[data-f=loop]").addEventListener("change", function (ev) {
        G.Project.updateSound(project, sound.id, { loop: ev.target.checked });
        ctx.onChange();
      });
      host.querySelector("[data-f=file]").addEventListener("change", function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          G.Project.updateSound(project, sound.id, { data: reader.result, mime: file.type || "audio/wav" });
          sound = G.Project.getSound(project, sound.id);
          ctx.onChange();
          G.Editors.sound.render(host, ctx);
        };
        reader.readAsDataURL(file);
      });
      host.querySelector("[data-act=play]").addEventListener("click", function () {
        if (!sound.data || typeof Audio === "undefined") return;
        if (audio) { try { audio.pause(); } catch (e) {} }
        audio = new Audio(sound.data);
        audio.loop = !!sound.loop;
        audio.play();
      });
      host.querySelector("[data-act=stop]").addEventListener("click", function () {
        if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }
      });
    }
  };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
