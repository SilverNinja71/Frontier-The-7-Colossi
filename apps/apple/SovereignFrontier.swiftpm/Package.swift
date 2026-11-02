// swift-tools-version: 6.0

// App Playground package: double-click SovereignFrontier.swiftpm to open it in Xcode, or open it in
// Swift Playgrounds on an iPad or Mac. Runs on iPad and on Apple-silicon Macs.

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "SovereignFrontier",
    platforms: [
        .iOS("17.0")
    ],
    products: [
        .iOSApplication(
            name: "Sovereign Frontier",
            targets: ["AppModule"],
            bundleIdentifier: "com.sovereignfrontier.app",
            teamIdentifier: "",
            displayVersion: "0.1",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .moon),
            accentColor: .presetColor(.cyan),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .landscapeRight,
                .landscapeLeft,
                .portrait,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ],
    swiftLanguageModes: [.v6]
)
