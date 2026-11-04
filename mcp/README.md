# geochase-mcp

MCP server that lets Claude Code or Claude Desktop drive the
[GeoChase](https://staormin.github.io/GeoChase/) map open in your browser: geocoding, OSM
search, circles, lines and their intersections, polygons, routes, elevations, notes,
image and PDF overlays, map capture… No API key is needed in GeoChase.

```
Claude ⇄ stdio (MCP) ⇄ geochase-mcp, on your computer ⇄ ws://127.0.0.1:47777 ⇄ GeoChase tab
```

## Setup

You need [Node.js](https://nodejs.org) 20 or later. You don't start the server yourself:
Claude starts and stops it.

1. Add the server to Claude, once.

   **Claude Code**

   ```bash
   claude mcp add --scope user geochase -- npx -y geochase-mcp
   ```

   **Claude Desktop**: add this to `claude_desktop_config.json` (Settings → Developer →
   Edit Config), then restart the app.

   ```json
   {
     "mcpServers": {
       "geochase": { "command": "npx", "args": ["-y", "geochase-mcp"] }
     }
   }
   ```

2. In [GeoChase](https://staormin.github.io/GeoChase/), open the assistant panel (magic
   wand, top right), then its settings, and turn on **Let Claude control this map**. This
   choice is remembered in your browser.

3. Keep GeoChase open on a project, and ask Claude, for example: "Place the castles of
   Fontainebleau and Chambord, then draw a 20 km circle around each."

## Good to know

- Each tool call is applied at once as one undo step, and Undo reverts it.
- Tools run in the tab, so they need GeoChase open on a map project. Image-map projects
  are not supported, and tools return an error while a dialog or drawing tool is open.
- The tools come from the tab. The first time, Claude may only list `geochase_status`
  until a tab connects.
- Chrome and Edge may ask you to allow the page to access your local network: accept it,
  or the tab stays on "Waiting for the GeoChase MCP server". Safari may block the
  connection from the public site.
- Only one Claude session and one tab are linked at a time. Another session takes over
  when the port is free.

## Security

The server listens on `127.0.0.1` only, and accepts connections only from
`https://staormin.github.io` and from localhost pages. Claude can change the open
project without confirmation, so turn the switch off when you don't want that.

## Configuration

| Variable            | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `GEOCHASE_ORIGINS`  | Extra page origins allowed to connect, separated by commas. |
| `GEOCHASE_MCP_PORT` | Server port, for tests: the app always connects to 47777.   |

## License

[MIT](http://opensource.org/licenses/MIT)
