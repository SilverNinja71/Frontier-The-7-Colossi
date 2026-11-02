import SwiftUI

@main
struct FrontierApp: App {
    @State private var state = GameState()

    var body: some Scene {
        WindowGroup {
            RootView(state: state)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    let state: GameState

    var body: some View {
        Group {
            switch state.route {
            case .creation:
                AzureVoidView { profile in
                    state.finishCreation(profile)
                }
                .transition(.opacity)
            case .world:
                if let pioneer = state.pioneer {
                    GameViewportView(profile: pioneer, onLeave: { state.startOver() })
                        .transition(.opacity)
                }
            }
        }
        .animation(.easeInOut(duration: 0.6), value: state.route)
    }
}
