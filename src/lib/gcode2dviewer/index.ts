/**
 * TypeScript wrapper for Handibot GCode2DViewer
 * Original library: https://github.com/ShopBotTools/Handibot-GCode2DViewer
 */

// Import the JavaScript libraries
import './gcodetogeometry.min.js'
import './gcode2dviewer.js'

// Type definitions
export interface GCode2DViewerColors {
    G0?: string // Travel moves color (hexadecimal #rrggbb)
    G1?: string // Linear moves color
    G2G3?: string // Arc moves color
}

export interface GCode2DViewerAPI {
    /**
     * Creates a preview of the G-code in the canvas
     * @param gcode - The G-code string to preview
     * @param colors - Color configuration for different move types
     * @param canvas - The HTML canvas element
     */
    preview(gcode: string, colors: GCode2DViewerColors, canvas: HTMLCanvasElement): void

    /**
     * Gets an image representing the G-code
     * @param gcode - The G-code string
     * @param colors - Color configuration
     * @param width - Image width
     * @param height - Image height
     * @returns Data URL of the generated image
     */
    getImage(gcode: string, colors: GCode2DViewerColors, width: number, height: number): string
}

// Declare the global GCode2DViewer object
declare global {
    interface Window {
        GCode2DViewer: GCode2DViewerAPI
    }
}

// Export the viewer from window
export const GCode2DViewer: GCode2DViewerAPI = (window as any).GCode2DViewer

export default GCode2DViewer
