/**
 * Registers Konva shape nodes used by the EPK canvas editor.
 *
 * react-konva imports `konva/lib/Core` only; Rect/Text/Image/Line/Transformer must
 * be side-effect-imported before any <Stage> renders. Import this module once at
 * each client entry point (EpkBuilderClient, EpkPublicViewer).
 */
import 'konva/lib/Core.js'
import 'konva/lib/shapes/Rect.js'
import 'konva/lib/shapes/Text.js'
import 'konva/lib/shapes/Image.js'
import 'konva/lib/shapes/Line.js'
import 'konva/lib/shapes/Transformer.js'