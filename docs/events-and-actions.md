# Gmlab events and simple-logic actions

These are the events and actions the runtime actually runs. The object editor builds action lists from this same catalog (`Gmlab.Docs` in `wwwroot/js/gmlab-docs.js`).

## Events

### `create` — Create

Runs once when an instance is created in a room (game start, room change, or `create_instance`).

### `destroy` — Destroy

Runs when the instance is destroyed, just before it is removed.

### `step` — Step

Runs every frame after keyboard events and before movement is applied.

### `collision` — Collision

Runs when this instance's sprite box overlaps another instance. If the other object is Solid, this instance is first moved back to its previous position, then the event runs. A non-solid overlap leaves the new position and still runs the event. Set `otherObjectId` to a specific object, or leave it empty to match any object.

### `keyboard` — Keyboard

Runs every frame while the named key is held down. Keys: left, right, up, down, space, enter, shift, a–z, 0–9.

### `keypress` — Key Press

Runs once on the frame the named key becomes down.

### `keyrelease` — Key Release

Runs once on the frame the named key becomes up.

### `draw` — Draw

Runs when the instance is drawn. If an object has no Draw event and Visible is on, the runtime draws its sprite (`draw_self`).

### `roomstart` — Room Start

Runs for each instance after a room has been entered and Create events have finished.

### `roomend` — Room End

Runs for each instance just before the room is left.

## Actions

### `move_fixed` — Move Fixed

Set direction (degrees, 0 = right, 90 = up) and speed in pixels per step. Updates hspeed/vspeed.

Parameters: `direction` (number), `speed` (number)

### `set_speed` — Set Speed

Set the instance speed (pixels per step) and recompute hspeed/vspeed from direction.

### `set_direction` — Set Direction

Set direction in degrees (0 = right, 90 = up) and recompute hspeed/vspeed from speed.

### `set_hspeed` — Set Horizontal Speed

Set hspeed and recompute speed/direction.

### `set_vspeed` — Set Vertical Speed

Set vspeed and recompute speed/direction. Positive is down.

### `jump_to` — Jump To Position

Set the instance x and y immediately.

### `create_instance` — Create Instance

Create a new instance of an object at (x, y) and run its Create event immediately.

### `destroy_instance` — Destroy Instance

Destroy this instance (runs Destroy, then removes it).

### `play_sound` — Play Sound

Play a sound resource through the runtime sound API.

### `stop_sound` — Stop Sound

Stop a sound resource through the runtime sound API.

### `start_path` — Start Path

Make this instance follow a path. Speed is pixels per step. End action is stop, restart, or reverse. Closed paths wrap from the last point back to the first.

### `stop_path` — Stop Path

Stop following the current path and resume free movement.

### `change_room` — Change Room

Leave the current room (Room End) and enter another (Create, Room Start). Queued until the end of the step.

### `set_variable` — Set Variable

Set an instance variable (number or string). Built-ins x, y, speed, direction, hspeed, vspeed, visible, solid are live.

### `if_variable` — If Variable

Compare an instance variable. If the test is false, the next action is skipped.

### `draw_self` — Draw Self

Draw this instance's sprite at (x - originX, y - originY).

### `comment` — Comment

A no-op note in the action list.

## Collision rules

- Overlap is axis-aligned using the sprite size and origin.
- Solid other: mover is restored to the previous position, then the Collision event runs.
- Non-solid other: position is kept, Collision event still runs.

## Movement

Direction uses Game Maker degrees: 0 right, 90 up, 180 left, 270 down. `hspeed = speed * cos(dir)`, `vspeed = -speed * sin(dir)`.
