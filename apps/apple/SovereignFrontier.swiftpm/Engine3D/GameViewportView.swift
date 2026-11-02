import Observation
import SceneKit
import SwiftUI

/// First playable slice of the native client: the pioneer from the Azure Void on a
/// proving ground with a sparring post that swings every few seconds. Use it to feel the
/// controller: camera-relative movement, dodge i-frames and the 12-frame parry window.
/// (The full world streams in here later via WorldZoneManager.)
struct GameViewportView: View {
    let profile: PioneerProfile
    let onLeave: () -> Void

    @State private var world = ProvingGround()

    var body: some View {
        ZStack {
            SceneView(scene: world.scene, pointOfView: world.cameraNode, options: [])
                .ignoresSafeArea()

            // Drives the fixed-step simulation once per display frame.
            TimelineView(.animation) { timeline in
                Color.clear
                    .onChange(of: timeline.date) { _, date in world.tick(now: date.timeIntervalSinceReferenceDate) }
            }
            .allowsHitTesting(false)

            TouchLayer(world: world)

            VStack {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(profile.name).font(.headline)
                        Text("\(profile.origin.title) · \(profile.job.title)")
                            .font(.caption).foregroundStyle(Color.white.opacity(0.7))
                        StaminaBar(value: world.stamina, exhausted: world.exhausted)
                    }
                    .padding(12)
                    .glassPanel(cornerRadius: 16)
                    Spacer()
                    Button("New pioneer", action: onLeave)
                        .buttonStyle(GlassButtonStyle(prominent: false))
                }
                .padding(16)
                Spacer()
                if let feedback = world.feedback {
                    Text(feedback.text)
                        .font(.system(size: 30, weight: .heavy, design: .rounded))
                        .tracking(3)
                        .foregroundStyle(feedback.color)
                        .shadow(color: .black.opacity(0.6), radius: 6)
                        .id(feedback.serial)
                        .transition(.scale.combined(with: .opacity))
                }
                Spacer()
                Text("WASD move · Q/E camera · Shift sprint · Space dodge · L parry on the white flash")
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.65))
                    .padding(.bottom, 14)
            }
        }
        .onAppear { world.start(profile: profile) }
    }
}

/// Simulation + scene for the proving ground.
@MainActor
@Observable
final class ProvingGround {
    struct Feedback: Equatable {
        let text: String
        let color: Color
        let serial: Int
    }

    let scene = SCNScene()
    let cameraNode = SCNNode()
    let input = InputRouter()
    @ObservationIgnored private var controller = CharacterController(position: .zero)
    @ObservationIgnored private var playerNode = SCNNode()
    private let post = SCNNode()
    private let postHead = SCNNode()
    @ObservationIgnored private var lastTime: Double?
    @ObservationIgnored private var accumulator: Double = 0
    @ObservationIgnored private var postFrame = 0
    @ObservationIgnored private var feedbackSerial = 0
    @ObservationIgnored private var started = false

    private(set) var stamina: Float = 100
    private(set) var exhausted = false
    private(set) var feedback: Feedback?

    /// The sparring post swings every `postCycle` frames; the strike lands at `postStrikeFrame`.
    private let postCycle = 170
    private let postStrikeFrame = 150
    private let postReach: Float = 2.8

    func start(profile: PioneerProfile) {
        guard !started else { return }
        started = true
        buildScene()
        controller = CharacterController(position: SIMD3(0, 0, 4), facingYaw: 0)
        let bonuses = profile.origin.bonuses
        controller.speedMultiplier = 1 + Float(bonuses.agility) * 0.5
        controller.sprintStaminaMultiplier = 1 + Float(bonuses.sprintStaminaCost)
        controller.poise = Float(bonuses.poise)
        playerNode = PioneerFigure.make(appearance: profile.appearance, origin: profile.origin, job: profile.job)
        scene.rootNode.addChildNode(playerNode)
        syncNodes(alpha: 1)
    }

    /// Fixed 60 Hz steps, scaled by the controller's slow motion after a parry.
    func tick(now: Double) {
        guard started else { return }
        let frameDelta = min(0.1, now - (lastTime ?? now))
        lastTime = now
        accumulator += frameDelta * Double(controller.timeScale)
        let step = Double(CharacterTuning.frameTime)
        var steps = 0
        while accumulator >= step && steps < 8 {
            accumulator -= step
            steps += 1
            simulate()
        }
        syncNodes(alpha: 1)
    }

    private func simulate() {
        let frameInput = input.sample(dt: CharacterTuning.frameTime)
        let events = controller.step(frameInput)
        if events.contains(.exhausted) { show("WINDED", .orange) }

        // Sparring post: wind up (head flashes gold, then white), then strike.
        postFrame = (postFrame + 1) % postCycle
        if postFrame == postStrikeFrame {
            let toPlayer = SIMD2(controller.position.x - post.simdPosition.x, controller.position.z - post.simdPosition.z)
            if simdLength(toPlayer) <= postReach {
                switch controller.resolveIncomingStrike(from: post.simdPosition) {
                case .parried: show("PARRY", .yellow)
                case .evaded: show("EVADED", .cyan)
                case let .mistimed(late): show("EARLY · \(late * 16) ms", .orange)
                case .hit:
                    show("HIT", .red)
                    controller.stun(frames: 20)
                }
            }
        }
        stamina = controller.stamina
        exhausted = controller.exhausted
    }

    private func syncNodes(alpha: Float) {
        playerNode.simdPosition = controller.position
        playerNode.simdEulerAngles = SIMD3(0, controller.facingYaw + .pi, 0)
        if case .dodging = controller.state {
            playerNode.opacity = controller.isInvulnerable ? 0.55 : 1
        } else {
            playerNode.opacity = 1
        }

        // Telegraph: gold during the wind-up, white for the final frames — parry on white.
        let warning = postFrame >= postStrikeFrame - 40 && postFrame < postStrikeFrame
        let flash = postFrame >= postStrikeFrame - 12 && postFrame < postStrikeFrame
        let material = postHead.geometry?.firstMaterial
        material?.emission.contents = flash ? CGColor(red: 1, green: 1, blue: 1, alpha: 1)
            : warning ? CGColor(red: 1, green: 0.75, blue: 0.2, alpha: 1)
            : CGColor(red: 0.1, green: 0.1, blue: 0.12, alpha: 1)
        let swing: Float = postFrame >= postStrikeFrame && postFrame < postStrikeFrame + 8 ? 1.2 : warning ? -0.5 : 0
        post.simdEulerAngles = SIMD3(0, post.simdEulerAngles.y, swing * 0.3)

        // Over-the-shoulder follow camera.
        let yaw = input.cameraYaw
        let back = -CharacterController.forward(yaw: yaw)
        let target = controller.position + SIMD3(0, 1.4, 0)
        cameraNode.simdPosition = target + SIMD3(back.x * 5.2, 1.6, back.y * 5.2)
        cameraNode.simdLook(at: target)
    }

    private func show(_ text: String, _ color: Color) {
        feedbackSerial += 1
        let serial = feedbackSerial
        withAnimation(.spring(duration: 0.25)) { feedback = Feedback(text: text, color: color, serial: serial) }
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(900))
            guard let self, self.feedback?.serial == serial else { return }
            withAnimation(.easeOut(duration: 0.3)) { self.feedback = nil }
        }
    }

    private func buildScene() {
        scene.background.contents = CGColor(red: 0.55, green: 0.72, blue: 0.9, alpha: 1)
        scene.fogColor = CGColor(red: 0.62, green: 0.76, blue: 0.9, alpha: 1)
        scene.fogStartDistance = 30
        scene.fogEndDistance = 90

        let camera = SCNCamera()
        camera.fieldOfView = 60
        camera.zFar = 200
        cameraNode.camera = camera
        scene.rootNode.addChildNode(cameraNode)

        let floor = SCNFloor()
        floor.reflectivity = 0
        floor.firstMaterial?.diffuse.contents = CGColor(red: 0.42, green: 0.58, blue: 0.3, alpha: 1)
        floor.firstMaterial?.lightingModel = .physicallyBased
        floor.firstMaterial?.roughness.contents = 0.95
        scene.rootNode.addChildNode(SCNNode(geometry: floor))

        let ring = SCNTorus(ringRadius: postReach_, pipeRadius: 0.03)
        ring.firstMaterial?.diffuse.contents = CGColor(red: 1, green: 0.85, blue: 0.4, alpha: 1)
        ring.firstMaterial?.lightingModel = .constant
        let ringNode = SCNNode(geometry: ring)
        ringNode.simdPosition = SIMD3(0, 0.02, 0)
        scene.rootNode.addChildNode(ringNode)

        // Sparring post.
        let wood = SCNMaterial()
        wood.diffuse.contents = CGColor(red: 0.45, green: 0.32, blue: 0.2, alpha: 1)
        let pole = SCNCylinder(radius: 0.14, height: 1.8)
        pole.materials = [wood]
        let poleNode = SCNNode(geometry: pole)
        poleNode.simdPosition = SIMD3(0, 0.9, 0)
        post.addChildNode(poleNode)
        let arm = SCNBox(width: 1.6, height: 0.12, length: 0.12, chamferRadius: 0.03)
        arm.materials = [wood]
        let armNode = SCNNode(geometry: arm)
        armNode.simdPosition = SIMD3(0.6, 1.3, 0)
        post.addChildNode(armNode)
        let head = SCNSphere(radius: 0.22)
        let headMaterial = SCNMaterial()
        headMaterial.diffuse.contents = CGColor(red: 0.2, green: 0.2, blue: 0.22, alpha: 1)
        head.materials = [headMaterial]
        postHead.geometry = head
        postHead.simdPosition = SIMD3(0, 1.95, 0)
        post.addChildNode(postHead)
        scene.rootNode.addChildNode(post)

        let sun = SCNLight()
        sun.type = .directional
        sun.intensity = 1100
        sun.castsShadow = true
        sun.shadowMode = .deferred
        let sunNode = SCNNode()
        sunNode.light = sun
        sunNode.simdEulerAngles = SIMD3(-0.9, 0.6, 0)
        scene.rootNode.addChildNode(sunNode)

        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.intensity = 450
        let ambientNode = SCNNode()
        ambientNode.light = ambient
        scene.rootNode.addChildNode(ambientNode)
    }

    private var postReach_: CGFloat { CGFloat(postReach) }
}

private struct StaminaBar: View {
    let value: Float
    let exhausted: Bool

    var body: some View {
        ZStack(alignment: .leading) {
            Capsule().fill(Color.white.opacity(0.12))
            Capsule()
                .fill(exhausted ? Color.orange : Color.green)
                .frame(width: CGFloat(max(0, min(1, value / 100))) * 160)
        }
        .frame(width: 160, height: 8)
    }
}

/// On-screen controls for iPad: a floating stick on the left, look-drag on the right,
/// and Dodge / Parry buttons.
private struct TouchLayer: View {
    let world: ProvingGround
    @State private var stickOrigin: CGPoint?
    @State private var stickOffset: CGSize = .zero

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.clear
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                if value.startLocation.x < geometry.size.width * 0.45 {
                                    stickOrigin = value.startLocation
                                    var dx = value.translation.width
                                    var dy = value.translation.height
                                    let length = (dx * dx + dy * dy).squareRoot()
                                    if length > 60 {
                                        dx = dx / length * 60
                                        dy = dy / length * 60
                                    }
                                    stickOffset = CGSize(width: dx, height: dy)
                                    world.input.touchMove = SIMD2(Float(dx / 60), Float(-dy / 60))
                                } else {
                                    world.input.addCameraDrag(Float(value.velocity.width) / 60)
                                }
                            }
                            .onEnded { _ in
                                stickOrigin = nil
                                stickOffset = .zero
                                world.input.touchMove = .zero
                            }
                    )

                if let origin = stickOrigin {
                    Circle()
                        .strokeBorder(Color.white.opacity(0.4), lineWidth: 2)
                        .background(Circle().fill(Color.black.opacity(0.2)))
                        .frame(width: 120, height: 120)
                        .position(origin)
                    Circle()
                        .fill(Color.white.opacity(0.6))
                        .frame(width: 48, height: 48)
                        .position(x: origin.x + stickOffset.width, y: origin.y + stickOffset.height)
                }

                VStack(spacing: 14) {
                    Spacer()
                    HStack(spacing: 14) {
                        Spacer()
                        RoundAction(title: "Parry", tint: .yellow) { world.input.queueTouchParry() }
                        RoundAction(title: "Dodge", tint: .cyan) { world.input.queueTouchDodge() }
                    }
                }
                .padding(28)
            }
        }
    }
}

private struct RoundAction: View {
    let title: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title.uppercased())
                .font(.caption.weight(.heavy))
                .tracking(1)
                .frame(width: 74, height: 74)
                .background(Circle().fill(tint.opacity(0.35)))
                .overlay(Circle().strokeBorder(Color.white.opacity(0.6), lineWidth: 2))
                .foregroundStyle(Color.white)
        }
        .buttonStyle(.plain)
    }
}
