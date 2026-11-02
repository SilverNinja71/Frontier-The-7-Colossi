import GameController

/// Merges keyboard (WASD), gamepad and on-screen touch controls into one `ControlInput`
/// per simulation frame, with edge detection for dodge and parry.
///
/// Keyboard: WASD / arrows move, Shift sprint, Space dodge, L or K parry, Q / E turn the camera.
/// Gamepad: left stick move, right stick camera, A dodge, RB parry, B or LT sprint.
@MainActor
final class InputRouter {
    /// Set by the touch joystick: x right, y forward.
    var touchMove: SIMD2<Float> = .zero
    var touchSprint = false
    private var touchDodgeQueued = false
    private var touchParryQueued = false

    private(set) var cameraYaw: Float = 0
    private var dodgeWasDown = false
    private var parryWasDown = false

    /// Radians per second for keyboard / stick camera turning.
    var cameraTurnRate: Float = 2.4

    func queueTouchDodge() { touchDodgeQueued = true }
    func queueTouchParry() { touchParryQueued = true }

    /// Drag-to-look from the touch surface (points).
    func addCameraDrag(_ deltaX: Float) {
        cameraYaw -= deltaX * 0.008
    }

    func sample(dt: Float) -> ControlInput {
        var move = touchMove
        var sprint = touchSprint
        var dodgeDown = false
        var parryDown = false
        var turn: Float = 0

        if let keyboard = GCKeyboard.coalesced?.keyboardInput {
            func down(_ code: GCKeyCode) -> Bool { keyboard.button(forKeyCode: code)?.isPressed ?? false }
            let x: Float = (down(.keyD) || down(.rightArrow) ? 1 : 0) - (down(.keyA) || down(.leftArrow) ? 1 : 0)
            let y: Float = (down(.keyW) || down(.upArrow) ? 1 : 0) - (down(.keyS) || down(.downArrow) ? 1 : 0)
            if x != 0 || y != 0 { move = SIMD2(x, y) }
            sprint = sprint || down(.leftShift) || down(.rightShift)
            dodgeDown = dodgeDown || down(.spacebar)
            parryDown = parryDown || down(.keyL) || down(.keyK)
            turn += (down(.keyQ) ? 1 : 0) - (down(.keyE) ? 1 : 0)
        }

        if let pad = GCController.current?.extendedGamepad {
            let stick = SIMD2(pad.leftThumbstick.xAxis.value, pad.leftThumbstick.yAxis.value)
            if simdLength(stick) > 0.15 { move = stick }
            turn -= deadzone(pad.rightThumbstick.xAxis.value)
            sprint = sprint || pad.buttonB.isPressed || pad.leftTrigger.value > 0.4
            dodgeDown = dodgeDown || pad.buttonA.isPressed
            parryDown = parryDown || pad.rightShoulder.isPressed
        }

        cameraYaw += turn * cameraTurnRate * dt
        let length = simdLength(move)
        if length > 1 { move /= length }

        let input = ControlInput(
            move: move,
            cameraYaw: cameraYaw,
            sprint: sprint,
            dodgePressed: (dodgeDown && !dodgeWasDown) || touchDodgeQueued,
            parryPressed: (parryDown && !parryWasDown) || touchParryQueued
        )
        dodgeWasDown = dodgeDown
        parryWasDown = parryDown
        touchDodgeQueued = false
        touchParryQueued = false
        return input
    }

    private func deadzone(_ value: Float) -> Float {
        abs(value) < 0.15 ? 0 : value
    }
}
