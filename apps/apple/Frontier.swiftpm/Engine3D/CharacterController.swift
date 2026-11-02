import Foundation

/// One frame of player intent, already merged from keyboard, gamepad and touch.
struct ControlInput: Equatable, Sendable {
    /// Stick or keys: x = right, y = forward. Length ≤ 1.
    var move: SIMD2<Float> = .zero
    /// Camera yaw in radians. 0 looks north (-z); positive turns left (towards -x).
    var cameraYaw: Float = 0
    var sprint = false
    /// Edge-triggered: true only on the frame the button went down.
    var dodgePressed = false
    var parryPressed = false

    static let idle = ControlInput()
}

/// Feel of the controller. Frame counts are at `CharacterTuning.simulationHz`.
struct CharacterTuning: Sendable {
    static let simulationHz: Float = 60
    static let frameTime: Float = 1 / simulationHz

    var walkSpeed: Float = 4.4
    var sprintSpeed: Float = 7.2
    /// Radians per second the body turns towards where it is moving.
    var turnRate: Float = 14
    var acceleration: Float = 38

    var dodgeFrames = 26
    /// Invulnerable on these frames of the roll (15 frames = 250 ms).
    var dodgeInvulnerableFrames: ClosedRange<Int> = 3...17
    var dodgeDistance: Float = 4.6
    var dodgeStaminaCost: Float = 18

    /// The precision window: a blow landing on frames 0..<12 of a parry is deflected (200 ms).
    var parryWindowFrames = 12
    /// Total commitment, window included: a missed parry leaves you open.
    var parryTotalFrames = 32
    var parryStaminaCost: Float = 8
    var parrySuccessRefund: Float = 12
    /// Blows within this cone around the facing direction can be parried.
    var parryFrontalArc: Float = 200 * .pi / 180
    /// After a successful parry the world runs at `parryTimeScale` for this many frames.
    var parryTimeDilationFrames = 24
    var parryTimeScale: Float = 0.3

    var maxStamina: Float = 100
    var staminaRegenPerSecond: Float = 30
    var staminaRegenDelayFrames = 36
    var sprintStaminaPerSecond: Float = 12
    /// Once emptied, stamina must refill to this before sprinting, dodging or parrying again.
    var exhaustionRecovery: Float = 35

    var bufferFrames = 8

    static let standard = CharacterTuning()
}

/// Deterministic third-person character: camera-relative movement, a dodge roll with
/// invulnerability frames and a 12-frame parry window. Pure value type stepped at a fixed
/// 60 Hz, so the same inputs always give the same result (ready for server checks and replays).
/// Mirrors the web build's shared motor in packages/combat-math.
struct CharacterController: Sendable {
    struct Events: OptionSet, Sendable {
        let rawValue: Int
        static let dodgeStarted = Events(rawValue: 1 << 0)
        static let parryStarted = Events(rawValue: 1 << 1)
        static let exhausted = Events(rawValue: 1 << 2)
        static let recovered = Events(rawValue: 1 << 3)
        static let actionRefused = Events(rawValue: 1 << 4)
    }

    let tuning: CharacterTuning
    /// From the origin (Beast Child +10%) and gear.
    var speedMultiplier: Float = 1

    private(set) var position: SIMD3<Float>
    private(set) var velocity: SIMD3<Float> = .zero
    private(set) var facingYaw: Float
    private(set) var state: CombatState = .idle
    private(set) var stamina: Float
    private(set) var exhausted = false
    private(set) var frame = 0
    /// Multiply world time by this (slow motion after a parry). Read by the viewport.
    private(set) var timeScale: Float = 1

    private var dodgeDirection: SIMD2<Float> = .zero
    private var buffered: BufferedAction?
    private var bufferedAge = 0
    private var framesSinceStaminaUse = Int.max / 2
    private var dilationFramesLeft = 0

    init(position: SIMD3<Float>, facingYaw: Float = 0, tuning: CharacterTuning = .standard) {
        self.position = position
        self.facingYaw = facingYaw
        self.tuning = tuning
        self.stamina = tuning.maxStamina
    }

    // MARK: Queries

    var isInvulnerable: Bool {
        if case let .dodging(f) = state { return tuning.dodgeInvulnerableFrames.contains(f) }
        return false
    }

    var isParryWindowOpen: Bool {
        if case let .parrying(f) = state { return f < tuning.parryWindowFrames }
        return false
    }

    /// Unit forward vector on the ground plane for a yaw.
    static func forward(yaw: Float) -> SIMD2<Float> {
        SIMD2(-sin(yaw), -cos(yaw))
    }

    static func yaw(facing direction: SIMD2<Float>) -> Float {
        atan2(-direction.x, -direction.y)
    }

    // MARK: Simulation

    /// Advance one fixed frame (1/60 s of game time).
    mutating func step(_ input: ControlInput) -> Events {
        let dt = CharacterTuning.frameTime
        var events: Events = []
        frame += 1
        framesSinceStaminaUse += 1

        if dilationFramesLeft > 0 {
            dilationFramesLeft -= 1
            timeScale = dilationFramesLeft > 0 ? tuning.parryTimeScale : 1
        }

        // Remember presses made while busy.
        if input.parryPressed {
            buffered = .parry
            bufferedAge = 0
        } else if input.dodgePressed {
            buffered = .dodge
            bufferedAge = 0
        } else if buffered != nil {
            bufferedAge += 1
            if bufferedAge > tuning.bufferFrames { buffered = nil }
        }

        advanceAction()

        let wish = Self.cameraRelative(input.move, cameraYaw: input.cameraYaw)
        if state.isFree, let action = buffered {
            events.formUnion(start(action, wish: wish))
        }

        switch state {
        case let .dodging(f):
            // Fast out of the gate, easing off: the speeds sum to `dodgeDistance`.
            let n = Float(tuning.dodgeFrames)
            let profile = 1.6 - 1.2 * Float(f) / n
            let speed = tuning.dodgeDistance / (n * dt) * profile
            velocity = SIMD3(dodgeDirection.x * speed, 0, dodgeDirection.y * speed)
        case .parrying, .stunned:
            velocity *= 0.7
        case .idle, .moving:
            let length = simdLength(wish)
            let sprinting = input.sprint && !exhausted && length > 0.1
            let top = (sprinting ? tuning.sprintSpeed : tuning.walkSpeed) * speedMultiplier
            let target = SIMD3(wish.x * top, 0, wish.y * top)
            velocity = Self.approach(velocity, target, maxDelta: tuning.acceleration * dt)
            if length > 0.05 {
                facingYaw = Self.turn(facingYaw, towards: Self.yaw(facing: wish), maxStep: tuning.turnRate * dt)
            }
            if sprinting, simdLength(SIMD2(velocity.x, velocity.z)) > 1 {
                spend(tuning.sprintStaminaPerSecond * dt, events: &events)
            }
            state = simdLength(SIMD2(velocity.x, velocity.z)) > 0.15 ? .moving : .idle
        }

        position += velocity * dt
        regenerate(dt: dt, events: &events)
        return events
    }

    /// The viewport keeps the character on the ground (terrain or physics floor).
    mutating func setGroundHeight(_ y: Float) {
        position.y = y
    }

    /// Resolve an enemy blow that reaches this character on the current frame.
    mutating func resolveIncomingStrike(from attacker: SIMD3<Float>) -> DefenseOutcome {
        if isInvulnerable { return .evaded }
        let toAttacker = SIMD2(attacker.x - position.x, attacker.z - position.z)
        let distance = simdLength(toAttacker)
        let facing = Self.forward(yaw: facingYaw)
        let inFront = distance < 1e-3 || acos(max(-1, min(1, simdDot(facing, toAttacker / distance)))) <= tuning.parryFrontalArc / 2

        if case let .parrying(f) = state {
            guard inFront else { return .hit }
            if f < tuning.parryWindowFrames {
                stamina = min(tuning.maxStamina, stamina + tuning.parrySuccessRefund)
                dilationFramesLeft = tuning.parryTimeDilationFrames
                timeScale = tuning.parryTimeScale
                // A clean parry ends the recovery early so a counter can follow.
                state = .idle
                return .parried
            }
            return .mistimed(framesLate: f - tuning.parryWindowFrames + 1)
        }
        return .hit
    }

    mutating func stun(frames: Int) {
        state = .stunned(framesLeft: frames)
        buffered = nil
    }

    // MARK: Internals

    private mutating func advanceAction() {
        switch state {
        case let .dodging(f):
            state = f + 1 >= tuning.dodgeFrames ? .idle : .dodging(frame: f + 1)
        case let .parrying(f):
            state = f + 1 >= tuning.parryTotalFrames ? .idle : .parrying(frame: f + 1)
        case let .stunned(left):
            state = left <= 1 ? .idle : .stunned(framesLeft: left - 1)
        case .idle, .moving:
            break
        }
    }

    private mutating func start(_ action: BufferedAction, wish: SIMD2<Float>) -> Events {
        let cost = action == .dodge ? tuning.dodgeStaminaCost : tuning.parryStaminaCost
        guard !exhausted, stamina > 0 else {
            buffered = nil
            return .actionRefused
        }
        buffered = nil
        var events: Events = []
        spend(cost, events: &events)
        switch action {
        case .dodge:
            // Roll where the stick points; with no input, hop backwards.
            let length = simdLength(wish)
            dodgeDirection = length > 0.1 ? wish / length : -Self.forward(yaw: facingYaw)
            if length > 0.1 { facingYaw = Self.yaw(facing: dodgeDirection) }
            state = .dodging(frame: 0)
            events.insert(.dodgeStarted)
        case .parry:
            state = .parrying(frame: 0)
            events.insert(.parryStarted)
        }
        return events
    }

    private mutating func spend(_ amount: Float, events: inout Events) {
        stamina = max(0, stamina - amount)
        framesSinceStaminaUse = 0
        if stamina == 0 && !exhausted {
            exhausted = true
            events.insert(.exhausted)
        }
    }

    private mutating func regenerate(dt: Float, events: inout Events) {
        guard framesSinceStaminaUse > tuning.staminaRegenDelayFrames else { return }
        stamina = min(tuning.maxStamina, stamina + tuning.staminaRegenPerSecond * dt)
        if exhausted && stamina >= tuning.exhaustionRecovery {
            exhausted = false
            events.insert(.recovered)
        }
    }

    /// Stick input rotated into the world by the camera's yaw.
    static func cameraRelative(_ move: SIMD2<Float>, cameraYaw: Float) -> SIMD2<Float> {
        let ahead = Self.forward(yaw: cameraYaw)
        let right = SIMD2(cos(cameraYaw), -sin(cameraYaw))
        var world = right * move.x + ahead * move.y
        let length = simdLength(world)
        if length > 1 { world /= length }
        return world
    }

    private static func approach(_ current: SIMD3<Float>, _ target: SIMD3<Float>, maxDelta: Float) -> SIMD3<Float> {
        let delta = target - current
        let length = simdLength(delta)
        return length <= maxDelta || length == 0 ? target : current + delta / length * maxDelta
    }

    private static func turn(_ yaw: Float, towards target: Float, maxStep: Float) -> Float {
        var delta = (target - yaw).truncatingRemainder(dividingBy: 2 * .pi)
        if delta > .pi { delta -= 2 * .pi }
        if delta < -.pi { delta += 2 * .pi }
        return yaw + max(-maxStep, min(maxStep, delta))
    }
}

// Small helpers so this file needs only the standard library's SIMD types.
@inline(__always) func simdDot(_ a: SIMD2<Float>, _ b: SIMD2<Float>) -> Float { (a * b).sum() }
@inline(__always) func simdLength(_ v: SIMD2<Float>) -> Float { simdDot(v, v).squareRoot() }
@inline(__always) func simdLength(_ v: SIMD3<Float>) -> Float { (v * v).sum().squareRoot() }
