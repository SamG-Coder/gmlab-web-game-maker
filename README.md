# Gmlab — Web Game Maker

A browser Game Maker 6–style IDE: sprites, objects (events + documented simple-logic actions), rooms, sounds, and paths. Play in the IDE, export a standalone HTML game, and share it as a link.

**Live:** https://samg-coder.github.io/gmlab-web-game-maker/

Public repo: https://github.com/SamG-Coder/gmlab-web-game-maker

The engine is plain JavaScript. ASP.NET hosts it locally. The `wwwroot` tree is CDN-ready (`<script src>` only — no modules).

## Run locally

```powershell
dotnet run --project src/Gmlab.Host
```

Open [http://127.0.0.1:5088](http://127.0.0.1:5088). You should see the Gmlab shell and the resource tree (Sprites, Sounds, Paths, Objects, Rooms).

## Tests

```powershell
dotnet test Gmlab.slnx
```

Tests load the shipped files under `src/Gmlab.Host/wwwroot/js` (they do not re-implement the model or runtime).

## What you get

| Resource | Editor | Runtime |
| --- | --- | --- |
| Sprite | Pixel frames + origin | Drawn at `x - originX`, `y - originY` |
| Object | Sprite, Visible, Solid, events, actions | Create / Step / Collision / Keyboard / Draw |
| Room | Size, speed, place instances | First room starts on Play / export |
| Sound | Import + preview | `play_sound` / `stop_sound` |
| Path | Ordered waypoints, open/closed | `start_path` advances along the polyline |

Events and actions are listed in [docs/events-and-actions.md](docs/events-and-actions.md) and in the IDE’s right-hand catalog. That catalog is the same object the dispatcher runs (`Gmlab.Docs`).

**Collision:** Solid others restore the mover’s previous position, then fire Collision. Non-solid others keep the new position and still fire Collision.

**Movement:** Game Maker degrees — 0 right, 90 up. `hspeed = speed * cos(dir)`, `vspeed = -speed * sin(dir)`.

## Export and share

1. **Export HTML** downloads a single file with no IDE chrome. Open it anywhere a browser can run a canvas.
2. **Share link** `POST`s that HTML to this host (`/api/share`) and returns `/s/{id}`. That is the playable shared-link system.
3. **Google Drive** is optional (`Gmlab.Share.publishGoogleDrive` with an OAuth access token). Drive often *downloads* HTML instead of running it, so the host `/s/{id}` link is the one that plays.

Shares live in the host process (they disappear on restart). For a public static copy, put `wwwroot` on any CDN or GitHub Pages and use Export HTML.

## Gemini

In the IDE, open **Gemini**, paste a [Google AI Studio](https://aistudio.google.com/apikey) API key, and send a prompt. The shipped hook is `Gmlab.Gemini.complete({ apiKey, prompt, endpoint })`.

- Served from ASP.NET: the hook posts to `/api/gemini`, which forwards to Gemini with your key.
- Missing or rejected keys return an `auth: …` error string (no crash).
- Tests point the same hook at a local echo endpoint.

## CDN / `file://`

`wwwroot` is the static site:

```
wwwroot/
  index.html          # IDE (plain script tags)
  css/ide.css
  js/gmlab-*.js       # model, runtime, export, share, gemini
  js/editors/*.js
  js/ide.js
  docs/events-and-actions.html
```

This repo deploys that folder to GitHub Pages on every push to `main` (see `.github/workflows/pages.yml`). Opening `index.html` as `file://` still runs (no ES modules). Share and the Gemini proxy need the ASP.NET host; the yellow banner says so instead of a blank page.

## Project layout

```
src/Gmlab.Host/           ASP.NET host + wwwroot
tests/Gmlab.Tests/        xUnit + Jint loading the shipped JS
docs/events-and-actions.md
```

## Keyboard in Play

Arrow keys / WASD-style letters, Space, Enter, Shift. Esc stops Play.
