# GCode 2D Viewer

A lightweight 2D G-code visualization library for plotter-style rendering, particularly suited for embroidery and pen plotter applications.

## Source

Based on [Handibot-GCode2DViewer](https://github.com/ShopBotTools/Handibot-GCode2DViewer) by ShopBotTools, Inc.

## Files

- `gcodetogeometry.min.js` - G-code parser and geometry converter
- `gcode2dviewer.js` - Canvas-based 2D renderer
- `index.ts` - TypeScript wrapper and type definitions

## Usage

### Basic Usage

```typescript
import '@/lib/gcode2dviewer/gcodetogeometry.min.js'
import '@/lib/gcode2dviewer/gcode2dviewer.js'

const canvas = document.getElementById('myCanvas') as HTMLCanvasElement
const gcode = 'G0 X0 Y0\nG1 X10 Y10\n...'

const colors = {
  G0: '#00FF00', // Travel moves (optional)
  G1: '#FF0000', // Linear moves
  G2G3: '#0000FF', // Arc moves (optional)
}

const viewer = (window as any).GCode2DViewer
viewer.preview(gcode, colors, canvas)
```

### Color Configuration

The `colors` object supports three properties:

- `G0` - Rapid positioning moves (travel). If omitted, G0 moves won't be displayed.
- `G1` - Linear interpolation moves (cutting/drawing/stitching).
- `G2G3` - Circular interpolation (arcs). If omitted, arcs won't be displayed.

All colors must be in hexadecimal format: `#RRGGBB`

### Export to Image

```typescript
const dataUrl = GCode2DViewer.getImage(gcode, colors, 800, 600)
// Returns a data URL that can be used as img src or downloaded
```

## Features

- **Pure 2D rendering** - XY plane only, perfect for plotters and embroidery
- **Lightweight** - No heavy dependencies, vanilla JavaScript
- **Canvas-based** - Hardware-accelerated rendering
- **Arc support** - Handles G2/G3 curved movements
- **Flexible colors** - Customize appearance per command type

## TurtleStitch Integration

This library is used in `GCodeStudio2DViewer.vue` for embroidery visualization. TurtleStitch G-code uses Z values as stitch counters (not height), which are stripped during preprocessing.

### TurtleStitch Color Support

TurtleStitch exports color information as comments:

```gcode
; color r:255 g:0 b:0
```

The viewer parses these comments and renders each color segment separately, compositing them onto the canvas for multi-color embroidery visualization.

## API Reference

### `GCode2DViewer.preview(gcode, colors, canvas)`

Renders G-code to a canvas element.

**Parameters:**

- `gcode` (string) - The G-code string to visualize
- `colors` (object) - Color configuration with G0, G1, and/or G2G3 properties
- `canvas` (HTMLCanvasElement) - The canvas element to render into

**Returns:** void

### `GCode2DViewer.getImage(gcode, colors, width, height)`

Generates an image from G-code.

**Parameters:**

- `gcode` (string) - The G-code string to visualize
- `colors` (object) - Color configuration
- `width` (number) - Image width in pixels
- `height` (number) - Image height in pixels

**Returns:** string (data URL)

## Limitations

- Only supports XY plane visualization (Z is ignored)
- No 3D rendering capabilities
- Canvas is cleared on each render
- No built-in zoom/pan controls (implement in wrapper component)

## License

Original library by Alex Canales for ShopBotTools, Inc.
