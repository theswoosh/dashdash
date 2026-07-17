---
title: Clock, Search, Bookmarks, Iframe & Frames
weight: 50
---

## Clock

A simple clock widget. Configure the time format (12- or 24-hour), pick a
timezone from a searchable list, and optionally show seconds or the
timezone label (with its current offset, e.g. "America/New_York · EDT
(GMT-4)"). You can place several clocks on one board, each set to a
different timezone.

## Search

A search box that submits to a search engine. Search engines are
configured by an admin (see [Configuration files]({{< relref "/configuration/files/" >}}));
the widget uses the first configured engine by default, or you can pick a
specific one in the widget's settings. The same engine list also powers the
search box in the topbar, if enabled.

## Bookmarks

A list of links you maintain yourself. Add entries with a label and a URL
from the bookmarks editor; each entry can have its own background and text
color, and colors can be copied from one entry and pasted onto another.
Choose between a flowing tile layout or a simple list. A URL you type
without `http://` or `https://` gets `https://` added automatically.

## Iframe

Embeds another web page directly inside a widget — useful for a page that
already gives you the information you want (a status page, a small
dashboard of its own) without you having to rebuild it. Set the URL to
embed in the widget's settings. Some sites block being embedded this way
on their end; if a page shows blank, that's usually why.

## Frames

A frame is a container widget: drag other widgets into it to group related
services together, visually and on the grid. Frames have their own inner
grid, so widgets inside a frame can be arranged independently of the rest
of the board. Drag a widget onto a frame to move it in; drag it back out
onto the open board to remove it from the frame. A frame can't be resized
smaller than the space its current contents need.
