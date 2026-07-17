---
title: Edit Mode
weight: 10
---

The board is read-only by default. Switch to edit mode to move widgets
around, resize them, add new ones, or delete them.

## Dragging and resizing

In edit mode, every widget can be dragged by its header (or, if the header
is hidden, by its edit pill — see below) and resized from its bottom-right
corner. Widgets snap to a grid so everything lines up cleanly.

Nothing moves until you move it — dashdash never auto-rearranges widgets to
make room. If you want to place something in occupied space, move the
widgets that are in the way first.

## Blocked moves

If you drag or resize a widget over another one, the spot turns red — that
move is blocked. Release the drag anywhere invalid and the widget snaps
back to where it started; nothing is lost.

The one exception is **frames**: dragging a widget onto a frame is allowed
and reparents it into that frame (see [Widgets: frames]({{< relref "/widgets/more-widgets/" >}}#frames)).
If the exact spot inside the frame is taken, dashdash finds the nearest
free spot for it automatically.

## Deleting a widget

Widgets don't delete on a single click, to protect against accidental
taps. Press and hold the delete control until it completes — this is
"hold-to-delete," used everywhere something is destructive.

## Hiding the header bar

Every widget has a "Hide header bar" option in its settings. Turning it on
removes the title bar from that widget so only its content shows. In edit
mode, a small pill with the drag handle and edit controls appears in the
widget's bottom-left corner so you can still move, resize, and configure it
even with the header hidden.

## The edit pill on narrow widgets

Once a widget is too narrow to fit its full header controls, the header
condenses and the same edit pill takes over — drag, configure, and delete
controls are all reachable from that one corner control, anchored to the
bottom-left so it never covers the resize handle.

## Tiny layout

Some widgets — most prominently healthchecks — offer a "tiny" layout in
their settings: a single fixed-height bar with the status dot and name.
A widget set to tiny pins to that bar height — you can resize it wider or
narrower, but not taller, until you switch the layout size back in its
settings.
