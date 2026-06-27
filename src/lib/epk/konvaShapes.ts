/**
 * Registers Konva shape nodes used by the EPK canvas editor.
 *
 * Next.js `optimizePackageImports` tree-shakes `konva` to its core build, so
 * react-konva cannot resolve Rect/Text/Image/Transformer unless we import them
 * here first.
 */
import 'konva/lib/shapes/Rect'
import 'konva/lib/shapes/Text'
import 'konva/lib/shapes/Image'
import 'konva/lib/shapes/Line'
import 'konva/lib/shapes/Transformer'