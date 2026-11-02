import CoreGraphics
import QuartzCore
import SceneKit

/// The 3D half of the Azure Chamber: an endless cobalt void with fog, cyan motes drifting
/// upwards, and a glass dais with pulsing runes on which the pioneer turns.
@MainActor
final class ChamberScene {
    let scene = SCNScene()
    let camera = SCNNode()
    private let turntable = SCNNode()
    private var figure: SCNNode?
    private var yaw: Float = 0
    private var dragBaseYaw: Float = 0

    init() {
        scene.background.contents = Self.gradientImage(top: PaletteColor(0x061121), middle: PaletteColor(0x0d284d), bottom: PaletteColor(0x02070f))
        scene.fogColor = PaletteColor(0x0a1d38).cgColor
        scene.fogStartDistance = 7
        scene.fogEndDistance = 26
        scene.fogDensityExponent = 1.4

        let cam = SCNCamera()
        cam.fieldOfView = 36
        cam.zNear = 0.05
        cam.zFar = 80
        cam.wantsHDR = true
        cam.bloomIntensity = 0.9
        cam.bloomThreshold = 0.6
        cam.bloomBlurRadius = 10
        camera.camera = cam
        camera.simdPosition = SIMD3(0, 1.45, 5.0)
        camera.look(at: SCNVector3(0, 1.0, 0))
        scene.rootNode.addChildNode(camera)

        addLights()
        addDais()
        addMotes()
        scene.rootNode.addChildNode(turntable)

        // Idle sway so the preview never looks frozen.
        turntable.runAction(.repeatForever(.sequence([
            .rotateBy(x: 0, y: 0.25, z: 0, duration: 4),
            .rotateBy(x: 0, y: -0.25, z: 0, duration: 4),
        ])))
    }

    /// Rebuild the pioneer when the creator changes anything.
    func show(appearance: Appearance, origin: PlayerOrigin?, job: BaseJob?) {
        figure?.removeFromParentNode()
        let next = PioneerFigure.make(appearance: appearance, origin: origin, job: job)
        next.simdPosition = SIMD3(0, 0.08, 0)
        next.simdEulerAngles = SIMD3(0, yaw, 0)
        turntable.addChildNode(next)
        figure = next
    }

    /// Drag to turn the pioneer on the dais.
    func dragChanged(translationX: Double) {
        yaw = dragBaseYaw + Float(translationX) * 0.012
        figure?.simdEulerAngles = SIMD3(0, yaw, 0)
    }

    func dragEnded() {
        dragBaseYaw = yaw
    }

    // MARK: Building

    private func addLights() {
        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.color = PaletteColor(0x2a3f8f).cgColor
        ambient.intensity = 420
        let ambientNode = SCNNode()
        ambientNode.light = ambient
        scene.rootNode.addChildNode(ambientNode)

        let key = SCNLight()
        key.type = .spot
        key.color = PaletteColor(0xd8f4ff).cgColor
        key.intensity = 1600
        key.spotInnerAngle = 18
        key.spotOuterAngle = 46
        key.castsShadow = true
        key.shadowMode = .deferred
        key.shadowColor = CGColor(red: 0, green: 0.02, blue: 0.1, alpha: 0.6)
        let keyNode = SCNNode()
        keyNode.light = key
        keyNode.simdPosition = SIMD3(1.2, 5.5, 2.4)
        keyNode.look(at: SCNVector3(0, 0.9, 0))
        scene.rootNode.addChildNode(keyNode)

        let rim = SCNLight()
        rim.type = .directional
        rim.color = PaletteColor(0x46d6ff).cgColor
        rim.intensity = 900
        let rimNode = SCNNode()
        rimNode.light = rim
        rimNode.simdPosition = SIMD3(-2, 2.5, -4)
        rimNode.look(at: SCNVector3(0, 1.2, 0))
        scene.rootNode.addChildNode(rimNode)

        // Light leaking up through the glass.
        let under = SCNLight()
        under.type = .omni
        under.color = PaletteColor(0x2fe0ff).cgColor
        under.intensity = 260
        under.attenuationStartDistance = 0.5
        under.attenuationEndDistance = 3
        let underNode = SCNNode()
        underNode.light = under
        underNode.simdPosition = SIMD3(0, -0.4, 0)
        scene.rootNode.addChildNode(underNode)
    }

    private func addDais() {
        let glass = SCNMaterial()
        glass.lightingModel = .physicallyBased
        glass.diffuse.contents = PaletteColor(0x7fdcff).cgColor
        glass.metalness.contents = 0.1
        glass.roughness.contents = 0.08
        glass.transparency = 0.32
        glass.emission.contents = PaletteColor(0x0e6f9a).cgColor
        glass.emission.intensity = 0.4
        glass.isDoubleSided = true
        let disc = SCNCylinder(radius: 1.7, height: 0.12)
        disc.radialSegmentCount = 64
        disc.materials = [glass]
        let dais = SCNNode(geometry: disc)
        dais.simdPosition = SIMD3(0, 0.02, 0)
        scene.rootNode.addChildNode(dais)

        let rune = SCNMaterial()
        rune.lightingModel = .constant
        rune.diffuse.contents = PaletteColor(0x7ff3ff).cgColor
        rune.emission.contents = PaletteColor(0x7ff3ff).cgColor

        let ring = SCNTorus(ringRadius: 1.52, pipeRadius: 0.012)
        ring.ringSegmentCount = 96
        ring.materials = [rune]
        let ringNode = SCNNode(geometry: ring)
        ringNode.simdPosition = SIMD3(0, 0.085, 0)
        scene.rootNode.addChildNode(ringNode)

        // Twelve rune glyphs, each pulsing a beat behind the last, slowly circling.
        let glyphs = SCNNode()
        glyphs.simdPosition = SIMD3(0, 0.086, 0)
        for i in 0..<12 {
            let angle = Float(i) / 12 * 2 * .pi
            let glyph = SCNBox(width: 0.16, height: 0.004, length: 0.05, chamferRadius: 0.01)
            glyph.materials = [rune]
            let node = SCNNode(geometry: glyph)
            node.simdPosition = SIMD3(sin(angle) * 1.32, 0, cos(angle) * 1.32)
            node.simdEulerAngles = SIMD3(0, angle, 0)
            node.opacity = 0.3
            node.runAction(.sequence([
                .wait(duration: Double(i) * 0.18),
                .repeatForever(.sequence([.fadeOpacity(to: 1, duration: 1.1), .fadeOpacity(to: 0.25, duration: 1.1)])),
            ]))
            glyphs.addChildNode(node)
        }
        glyphs.runAction(.repeatForever(.rotateBy(x: 0, y: 2 * .pi, z: 0, duration: 60)))
        scene.rootNode.addChildNode(glyphs)
    }

    private func addMotes() {
        let motes = SCNParticleSystem()
        motes.birthRate = 70
        motes.particleLifeSpan = 7
        motes.particleLifeSpanVariation = 2
        motes.emitterShape = SCNBox(width: 12, height: 0.2, length: 10, chamferRadius: 0)
        motes.emittingDirection = SCNVector3(0, 1, 0)
        motes.spreadingAngle = 12
        motes.particleVelocity = 0.32
        motes.particleVelocityVariation = 0.18
        motes.particleSize = 0.035
        motes.particleSizeVariation = 0.025
        motes.particleColor = PaletteColor(0x7ff3ff).cgColor
        motes.particleColorVariation = SCNVector4(0.05, 0, 0.2, 0)
        motes.blendMode = .additive
        motes.isLightingEnabled = false
        motes.particleImage = Self.softDotImage()
        motes.warmupDuration = 6

        let fade = CAKeyframeAnimation()
        fade.values = [0.0, 1.0, 1.0, 0.0]
        fade.keyTimes = [0, 0.2, 0.75, 1]
        motes.propertyControllers = [.opacity: SCNParticlePropertyController(animation: fade)]

        let emitter = SCNNode()
        emitter.simdPosition = SIMD3(0, -1.2, -1)
        emitter.addParticleSystem(motes)
        scene.rootNode.addChildNode(emitter)
    }

    // MARK: Generated images

    /// A soft round sprite for the motes.
    static func softDotImage(size: Int = 64) -> CGImage? {
        let space = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
            space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        let colors = [CGColor(red: 1, green: 1, blue: 1, alpha: 1), CGColor(red: 1, green: 1, blue: 1, alpha: 0)] as CFArray
        let locations: [CGFloat] = [0, 1]
        guard let gradient = CGGradient(colorsSpace: space, colors: colors, locations: locations) else { return nil }
        let center = CGPoint(x: CGFloat(size) / 2, y: CGFloat(size) / 2)
        context.drawRadialGradient(gradient, startCenter: center, startRadius: 0, endCenter: center, endRadius: CGFloat(size) / 2, options: [])
        return context.makeImage()
    }

    /// The void: a vertical three-stop gradient used as the scene background.
    static func gradientImage(top: PaletteColor, middle: PaletteColor, bottom: PaletteColor) -> CGImage? {
        let space = CGColorSpaceCreateDeviceRGB()
        let width = 4
        let height = 512
        guard let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        let colors = [bottom.cgColor, middle.cgColor, top.cgColor] as CFArray
        let locations: [CGFloat] = [0, 0.45, 1]
        guard let gradient = CGGradient(colorsSpace: space, colors: colors, locations: locations) else { return nil }
        context.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: height), options: [])
        return context.makeImage()
    }
}
