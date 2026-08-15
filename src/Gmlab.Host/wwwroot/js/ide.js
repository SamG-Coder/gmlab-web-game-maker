(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  var KINDS = [
    { id: "sprites", label: "Sprites", kind: "sprite", create: "addSprite", defaults: { name: "sprite", width: 16, height: 16, originX: 0, originY: 0 } },
    { id: "sounds", label: "Sounds", kind: "sound", create: "addSound", defaults: { name: "sound" } },
    { id: "paths", label: "Paths", kind: "path", create: "addPath", defaults: { name: "path", closed: false, points: [] } },
    { id: "objects", label: "Objects", kind: "object", create: "addObject", defaults: { name: "object", visible: true, solid: false, events: [] } },
    { id: "rooms", label: "Rooms", kind: "room", create: "addRoom", defaults: { name: "room", width: 640, height: 480, speed: 30 } }
  ];

  var state = {
    project: null,
    selection: null,
    playTimer: null,
    playGame: null
  };

  function $(sel, rootEl) {
    return (rootEl || document).querySelector(sel);
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.firstElementChild;
  }

  function loadExportSources() {
    if (typeof fetch !== "function") return;
    var base = "js/";
    Promise.all([
      fetch(base + "gmlab-project.js").then(function (r) { return r.text(); }),
      fetch(base + "gmlab-runtime.js").then(function (r) { return r.text(); })
    ]).then(function (parts) {
      G.Export.setSources({ project: parts[0], runtime: parts[1] });
    }).catch(function () {
      /* file:// or offline — export will explain */
    });
  }

  function fileProtocolBanner() {
    if (typeof location === "undefined" || location.protocol !== "file:") return;
    var bar = document.getElementById("file-banner");
    if (bar) bar.hidden = false;
  }

  function newProject() {
    state.project = G.Project.create({ name: "My Game" });
    var spr = G.Project.addSprite(state.project, { name: "sprPlayer", width: 16, height: 16, originX: 8, originY: 8, fill: 0xff3d8bff });
    var obj = G.Project.addObject(state.project, {
      name: "objPlayer",
      spriteId: spr.id,
      visible: true,
      solid: false,
      events: [{ type: "create", actions: [{ type: "move_fixed", direction: 0, speed: 2 }] }]
    });
    var room = G.Project.addRoom(state.project, { name: "rmMain", width: 320, height: 240, speed: 30 });
    G.Project.addInstance(state.project, room.id, { objectId: obj.id, x: 40, y: 40 });
    G.Project.addSound(state.project, { name: "sndBeep" });
    G.Project.addPath(state.project, { name: "pthLoop", closed: false, points: [{ x: 20, y: 20, speed: 100 }, { x: 200, y: 20, speed: 100 }] });
    state.selection = { kind: "room", id: room.id };
    persist();
    renderAll();
  }

  function persist() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("gmlab.project", G.Project.toJSON(state.project));
      }
    } catch (e) { /* ignore quota */ }
  }

  function restore() {
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem("gmlab.project");
        if (raw) {
          state.project = G.Project.fromJSON(raw);
          return true;
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function resourceByKind(kind, id) {
    if (kind === "sprite") return G.Project.getSprite(state.project, id);
    if (kind === "object") return G.Project.getObject(state.project, id);
    if (kind === "room") return G.Project.getRoom(state.project, id);
    if (kind === "sound") return G.Project.getSound(state.project, id);
    if (kind === "path") return G.Project.getPath(state.project, id);
    return null;
  }

  function listByKind(kind) {
    if (kind === "sprite") return G.Project.listSprites(state.project);
    if (kind === "object") return G.Project.listObjects(state.project);
    if (kind === "room") return G.Project.listRooms(state.project);
    if (kind === "sound") return G.Project.listSounds(state.project);
    if (kind === "path") return G.Project.listPaths(state.project);
    return [];
  }

  function renderTree() {
    var tree = document.getElementById("resource-tree");
    if (!tree || !state.project) return;
    var html = "<div class='tree-title'>Resources</div>";
    KINDS.forEach(function (group) {
      html += "<div class='tree-group' data-kind='" + group.kind + "'>";
      html += "<div class='tree-head'><span>" + group.label + "</span>";
      html += "<button type='button' class='mini' data-create='" + group.kind + "'>+</button></div>";
      html += "<ul>";
      listByKind(group.kind).forEach(function (res) {
        var sel = state.selection && state.selection.kind === group.kind && state.selection.id === res.id ? " selected" : "";
        html += "<li><button type='button' class='tree-item" + sel + "' data-open-kind='" + group.kind + "' data-open-id='" + res.id + "'>" +
          escape(res.name) + "</button></li>";
      });
      html += "</ul></div>";
    });
    tree.innerHTML = html;
    tree.querySelectorAll("[data-create]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        createResource(btn.getAttribute("data-create"));
      });
    });
    tree.querySelectorAll("[data-open-kind]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openResource(btn.getAttribute("data-open-kind"), btn.getAttribute("data-open-id"));
      });
    });
    var nameInput = document.getElementById("project-name");
    if (nameInput) nameInput.value = state.project.name || "Game";
  }

  function openResource(kind, id) {
    state.selection = { kind: kind, id: id };
    renderTree();
    renderEditor();
  }

  function createResource(kind) {
    var group = KINDS.filter(function (k) { return k.kind === kind; })[0];
    if (!group) return;
    var created = G.Project[group.create](state.project, Object.assign({}, group.defaults, {
      name: uniqueName(kind, group.defaults.name)
    }));
    persist();
    openResource(kind, created.id);
  }

  function uniqueName(kind, base) {
    var names = listByKind(kind).map(function (r) { return r.name; });
    if (names.indexOf(base) < 0) return base;
    var n = 2;
    while (names.indexOf(base + n) >= 0) n++;
    return base + n;
  }

  function renderEditor() {
    var host = document.getElementById("editor-host");
    if (!host) return;
    if (!state.selection) {
      host.innerHTML = "<div class='welcome' data-editor='welcome'>" +
        "<h2>Gmlab</h2>" +
        "<p>A Game Maker 6–style web IDE. Create sprites, objects with events and documented actions, rooms, sounds, and paths. Press Play, then Export a shareable HTML game.</p>" +
        "<p><button type='button' id='welcome-sample'>Open demo game</button> " +
        "<button type='button' id='welcome-new'>Blank game</button></p></div>";
      var s = document.getElementById("welcome-sample");
      if (s) s.addEventListener("click", function () {
        state.project = G.Sample.build();
        state.selection = { kind: "room", id: state.project.firstRoomId };
        persist();
        renderAll();
      });
      var n = document.getElementById("welcome-new");
      if (n) n.addEventListener("click", newProject);
      return;
    }
    var editor = G.Editors[state.selection.kind];
    var resource = resourceByKind(state.selection.kind, state.selection.id);
    if (!editor || !resource) {
      host.innerHTML = "<p class='empty'>Editor not available.</p>";
      return;
    }
    editor.render(host, {
      project: state.project,
      resource: resource,
      kind: state.selection.kind,
      ide: G.IDE,
      onChange: function () {
        persist();
        renderTree();
      }
    });
  }

  function renderDocs() {
    var pane = document.getElementById("docs-pane");
    if (!pane || !G.Docs) return;
    var html = "<h2>Events &amp; actions</h2><p class='micro'>This is the catalog the runtime executes.</p>";
    html += "<h3>Events</h3><dl>";
    G.Docs.events.forEach(function (e) {
      html += "<dt><code>" + e.id + "</code> " + escape(e.name) + "</dt><dd>" + escape(e.description) + "</dd>";
    });
    html += "</dl><h3>Actions</h3><dl>";
    G.Docs.actions.forEach(function (a) {
      html += "<dt><code>" + a.id + "</code> " + escape(a.name) + "</dt><dd>" + escape(a.description) + "</dd>";
    });
    html += "</dl>";
    pane.innerHTML = html;
  }

  function renderAll() {
    renderTree();
    renderEditor();
    renderDocs();
  }

  function mapKey(ev) {
    var k = ev.key;
    if (k === "ArrowLeft" || k === "Left") return "left";
    if (k === "ArrowRight" || k === "Right") return "right";
    if (k === "ArrowUp" || k === "Up") return "up";
    if (k === "ArrowDown" || k === "Down") return "down";
    if (k === " ") return "space";
    if (k === "Enter") return "enter";
    if (k === "Shift") return "shift";
    if (k && k.length === 1) return k.toLowerCase();
    return "";
  }

  function defaultSoundApi() {
    var nodes = {};
    function make(sound) {
      if (!sound || !sound.data || typeof Audio === "undefined") return null;
      var a = new Audio(sound.data);
      a.loop = !!sound.loop;
      return a;
    }
    return {
      play: function (id, sound) {
        var a = nodes[id] || make(sound);
        if (!a) return;
        nodes[id] = a;
        try { a.currentTime = 0; a.play(); } catch (e) {}
      },
      stop: function (id) {
        var a = nodes[id];
        if (!a) return;
        try { a.pause(); a.currentTime = 0; } catch (e) {}
      }
    };
  }

  function stopPlay() {
    if (state.playTimer) {
      cancelAnimationFrame(state.playTimer);
      state.playTimer = null;
    }
    state.playGame = null;
    var overlay = document.getElementById("play-overlay");
    if (overlay) overlay.hidden = true;
  }

  function play() {
    var overlay = document.getElementById("play-overlay");
    var canvas = document.getElementById("play-stage");
    if (!overlay || !canvas) return;
    overlay.hidden = false;
    state.playGame = G.Runtime.create(state.project, { soundApi: defaultSoundApi() });
    G.Runtime.start(state.playGame);
    var room = state.playGame.room;
    canvas.width = room ? room.width : 320;
    canvas.height = room ? room.height : 240;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
    var ctx = canvas.getContext("2d");
    G.Runtime.draw(state.playGame, ctx);
    var acc = 0;
    var last = performance.now();
    var stepMs = 1000 / ((room && room.speed) || 30);
    function frame(now) {
      if (!state.playGame) return;
      acc += now - last;
      last = now;
      var guard = 0;
      while (acc >= stepMs && guard++ < 5) {
        G.Runtime.step(state.playGame);
        acc -= stepMs;
      }
      G.Runtime.draw(state.playGame, ctx);
      state.playTimer = requestAnimationFrame(frame);
    }
    state.playTimer = requestAnimationFrame(frame);
  }

  function exportHtml() {
    try {
      return G.Export.toStandaloneHtml(state.project);
    } catch (err) {
      status("Export needs the IDE served over http (ASP.NET or a CDN). " + err.message);
      return null;
    }
  }

  function downloadExport() {
    var html = exportHtml();
    if (!html) return;
    var blob = new Blob([html], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (state.project.name || "game").replace(/\s+/g, "-") + ".html";
    a.click();
    status("Saved standalone HTML.");
  }

  function shareGame() {
    var html = exportHtml();
    if (!html) return;
    var origin = location.origin;
    G.Share.publish(html, { origin: origin }).then(function (res) {
      if (res.error) {
        status(res.error);
        return;
      }
      var url = res.url;
      status("Share link: " + url);
      var box = document.getElementById("share-url");
      if (box) {
        box.hidden = false;
        box.value = url;
        box.select();
      }
    });
  }

  function askGemini() {
    var key = ($("#gemini-key") || {}).value || "";
    var prompt = ($("#gemini-prompt") || {}).value || "";
    var out = document.getElementById("gemini-out");
    if (!prompt) {
      if (out) out.textContent = "Write a prompt first.";
      return;
    }
    try { localStorage.setItem("gmlab.geminiKey", key); } catch (e) {}
    var summary = "Project " + state.project.name +
      " sprites=" + state.project.sprites.length +
      " objects=" + state.project.objects.length +
      " rooms=" + state.project.rooms.length;
    var full = prompt + "\n\nContext: " + summary;
    if (out) out.textContent = "Asking Gemini…";
    G.Gemini.complete({ apiKey: key, prompt: full }).then(function (res) {
      if (out) out.textContent = res.error || res.text || "";
    });
  }

  function status(msg) {
    var elStatus = document.getElementById("status");
    if (elStatus) elStatus.textContent = msg;
  }

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function bindChrome() {
    document.getElementById("btn-new").addEventListener("click", function () {
      if (confirm("Replace the current project with a blank game?")) newProject();
    });
    document.getElementById("btn-sample").addEventListener("click", function () {
      state.project = G.Sample.build();
      state.selection = { kind: "room", id: state.project.firstRoomId };
      persist();
      renderAll();
    });
    document.getElementById("btn-play").addEventListener("click", play);
    document.getElementById("btn-stop").addEventListener("click", stopPlay);
    document.getElementById("btn-export").addEventListener("click", downloadExport);
    document.getElementById("btn-share").addEventListener("click", shareGame);
    document.getElementById("btn-gemini").addEventListener("click", function () {
      document.getElementById("gemini-panel").hidden = !document.getElementById("gemini-panel").hidden;
    });
    document.getElementById("gemini-send").addEventListener("click", askGemini);
    document.getElementById("project-name").addEventListener("change", function (ev) {
      state.project.name = ev.target.value;
      persist();
    });
    document.getElementById("btn-save").addEventListener("click", function () {
      persist();
      var blob = new Blob([G.Project.toJSON(state.project)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (state.project.name || "game") + ".gmlab.json";
      a.click();
    });
    document.getElementById("btn-open").addEventListener("click", function () {
      document.getElementById("open-file").click();
    });
    document.getElementById("open-file").addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        state.project = G.Project.fromJSON(String(reader.result));
        state.selection = null;
        persist();
        renderAll();
      };
      reader.readAsText(file);
    });

    window.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") stopPlay();
      if (!state.playGame) return;
      var name = mapKey(ev);
      if (name) {
        G.Runtime.setKey(state.playGame, name, true);
        ev.preventDefault();
      }
    });
    window.addEventListener("keyup", function (ev) {
      if (!state.playGame) return;
      var name = mapKey(ev);
      if (name) G.Runtime.setKey(state.playGame, name, false);
    });

    try {
      var savedKey = localStorage.getItem("gmlab.geminiKey");
      if (savedKey && $("#gemini-key")) $("#gemini-key").value = savedKey;
    } catch (e) {}
  }

  G.IDE = {
    KINDS: KINDS,
    getProject: function () { return state.project; },
    setProject: function (p) { state.project = p; persist(); renderAll(); },
    openResource: openResource,
    createResource: createResource,
    play: play,
    stopPlay: stopPlay,
    exportHtml: exportHtml,
    init: function () {
      if (typeof document === "undefined") return;
      fileProtocolBanner();
      loadExportSources();
      if (!restore()) {
        state.project = G.Sample.build();
        state.selection = null;
      }
      bindChrome();
      renderAll();
    }
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { G.IDE.init(); });
    } else {
      G.IDE.init();
    }
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
