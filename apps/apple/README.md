# Frontier of the Colossi — native Apple client (early)

The start of a native client for **Frontier of the Colossi**, written in Swift 6
with SwiftUI and SceneKit. It is an Xcode **App Playground** (`Frontier.swiftpm`), so
there is no project file to manage:

- **Mac:** double-click `Frontier.swiftpm`. Xcode opens it. Pick **My Mac (Designed for
  iPad)** or an iPad simulator as the run destination and press ▶ (Run).
- **iPad:** copy `Frontier.swiftpm` to the iPad (AirDrop or iCloud Drive) and open it in
  the free **Swift Playgrounds** app.

It needs Xcode 16 or later (Swift 6), iPadOS 17+, and an Apple-silicon Mac to run on a Mac.
It has not been compiled yet: this code was written in a Linux environment with no Swift
toolchain. If Xcode reports an error, paste it back and it will get fixed.

## What is here

| Folder | File | What it does |
| --- | --- | --- |
| `App/` | `FrontierApp.swift` | App entry and routing (Azure Chamber → world). |
| | `GameState.swift` | Saves the created pioneer and decides which screen shows. |
| `Creation/` | `AzureChamberView.swift` | Character creation: name, appearance, origin, job, confirm. Glass panels over the 3D chamber. |
| | `ChamberScene.swift` | The SceneKit chamber: cobalt void, fog, rising cyan motes, glass dais with pulsing runes. |
| | `PioneerFigure.swift` | Builds the preview character from primitives (hair, colours, starting gear). |
| `Creation/Models/` | `PlayerOrigin.swift` | The 8 origins: perks, starting equipment, spawn point. |
| | `Pioneer.swift` | Jobs and their advancement paths, attributes, appearance, name validation. |
| `Combat/` | `CombatStateMachine.swift` | Character states and defence outcomes. |
| `Engine3D/` | `CharacterController.swift` | Camera-relative movement, dodge roll with i-frames, 12-frame parry window, stamina, slow motion after a parry. A fixed 60 Hz value type, so it is deterministic. |
| | `InputRouter.swift` | Keyboard (WASD), gamepad and touch merged into one input per frame. |
| | `GameViewportView.swift` | A proving ground: your pioneer plus a sparring post that swings every few seconds, for feeling the controller. |

## Controls (proving ground)

WASD or arrows to move, Q / E to turn the camera, Shift to sprint, Space to dodge, L (or K)
to parry. Parry when the post's head flashes **white**: the window is 12 frames (200 ms).
On a gamepad: left stick to move, right stick for the camera, A to dodge, RB to parry, B or LT
to sprint. On an iPad: drag on the left for the stick, drag on the right to look, and use the
Parry and Dodge buttons.

## Origins

| Origin | Perk | Starts at |
| --- | --- | --- |
| The Drifter | +15% Luck (crits, rare drops); twin starter daggers, no armour | The Bramble Wilds, skipping the town |
| Noble Blood | +10% Max Mana, +15% cast speed | The First Bastion, town square |
| Untamed Hero | +10% Vitality/HP, +5% physical defense | The First Bastion, garrison |
| Beast Child | +10% Agility, sprinting costs 20% less, monsters notice you 25% closer | Training grounds |
| Blade Disciple | +10% sword/dagger attack speed, Iron Sword | Training grounds |
| Commoner | +3 to every base attribute | Town square |
| Optimist | Debuffs wear off 25% sooner | Town square |
| Opportunist | 15% discount at town vendors | Town square |

Timings match the web build's shared combat package (`packages/combat-math`): its 6-tick
perfect parry at 30 Hz is the same 200 ms as 12 frames at 60 Hz here.

## Next steps

Cel-shading via SceneKit shader modifiers, porting the Bramble Wilds terrain
(`apps/client/src/world/geography.ts` is pure math and ports directly), the Shadow Stalker
brain, and loading `.usdz` models from the asset pipeline.
