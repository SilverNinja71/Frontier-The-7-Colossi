import Foundation
import Observation

/// App-wide routing: Azure Void (creation) → the world → (later) colossus raids.
@MainActor
@Observable
final class GameState {
    enum Route: Equatable {
        case creation
        case world
    }

    private(set) var route: Route
    private(set) var pioneer: PioneerProfile?

    private static let storageKey = "frontier.pioneer"

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let saved = try? JSONDecoder().decode(PioneerProfile.self, from: data) {
            pioneer = saved
            route = .world
        } else {
            route = .creation
        }
    }

    func finishCreation(_ profile: PioneerProfile) {
        pioneer = profile
        if let data = try? JSONEncoder().encode(profile) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
        route = .world
    }

    /// Back to the Azure Void (keeps nothing).
    func startOver() {
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
        pioneer = nil
        route = .creation
    }
}
