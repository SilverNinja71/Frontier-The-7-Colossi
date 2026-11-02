import Foundation

/// What a character is doing this frame. Frame counters count fixed 60 Hz simulation
/// frames from the start of the action, so windows are exact and replayable.
enum CombatState: Equatable, Sendable {
    case idle
    case moving
    case dodging(frame: Int)
    case parrying(frame: Int)
    case stunned(framesLeft: Int)

    /// Free to move and to start a new action.
    var isFree: Bool {
        switch self {
        case .idle, .moving: true
        case .dodging, .parrying, .stunned: false
        }
    }

    var label: String {
        switch self {
        case .idle: "Idle"
        case .moving: "Moving"
        case .dodging: "Dodge"
        case .parrying: "Parry"
        case .stunned: "Stunned"
        }
    }
}

/// How an incoming strike was met.
enum DefenseOutcome: Equatable, Sendable {
    /// Inside the 12-frame window and facing the blow: deflected, time slows.
    case parried
    /// Inside the dodge roll's invulnerability frames.
    case evaded
    /// Parry pressed too early: the window had already closed this many frames before the blow.
    case mistimed(framesLate: Int)
    case hit
}

/// Actions pressed while busy are remembered briefly and fire as soon as the character is free.
enum BufferedAction: Equatable, Sendable {
    case dodge
    case parry
}
