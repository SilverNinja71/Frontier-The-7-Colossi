import CoreGraphics
import SceneKit

/// Builds the stylised low-poly pioneer from primitives, so character creation needs no
/// model files. Swap in a .usdz from the asset pipeline later by replacing `make`.
enum PioneerFigure {
    /// Root node with feet at the origin, facing +z (towards the chamber camera).
    @MainActor
    static func make(appearance: Appearance, origin: PlayerOrigin?, job: BaseJob?) -> SCNNode {
        let root = SCNNode()
        root.name = "pioneer"

        let skin = material(appearance.skinTone)
        let outfit = material(appearance.outfitColor)
        let hair = material(appearance.hairColor, roughness: 0.55)
        let eyes = material(appearance.eyeColor, emission: 0.35)
        let boots = material(PaletteColor(0x2a2018))
        let bareChested = origin == .drifter

        // Legs: shorts for the Wanderer, trousers otherwise.
        for side: Float in [-1, 1] {
            let thigh = node(SCNCapsule(capRadius: 0.085, height: 0.46), outfit, at: SIMD3(side * 0.11, 0.73, 0))
            let shin = node(SCNCapsule(capRadius: 0.075, height: 0.44), bareChested ? skin : outfit, at: SIMD3(side * 0.11, 0.33, 0))
            let boot = node(SCNBox(width: 0.15, height: 0.1, length: 0.24, chamferRadius: 0.03), boots, at: SIMD3(side * 0.11, 0.05, 0.03))
            root.addChildNode(thigh)
            root.addChildNode(shin)
            root.addChildNode(boot)
        }

        // Torso, belt, arms.
        root.addChildNode(node(SCNCapsule(capRadius: 0.19, height: 0.62), bareChested ? skin : outfit, at: SIMD3(0, 1.2, 0)))
        root.addChildNode(node(SCNCylinder(radius: 0.2, height: 0.07), boots, at: SIMD3(0, 0.93, 0)))
        for side: Float in [-1, 1] {
            let arm = node(SCNCapsule(capRadius: 0.06, height: 0.58), bareChested ? skin : outfit, at: SIMD3(side * 0.28, 1.18, 0))
            arm.simdEulerAngles = SIMD3(0, 0, side * 0.12)
            root.addChildNode(arm)
            root.addChildNode(node(SCNSphere(radius: 0.06), skin, at: SIMD3(side * 0.32, 0.88, 0.01)))
        }
        if origin == .nobleBlood {
            // A short cape for the old blood.
            let cape = node(SCNBox(width: 0.42, height: 0.7, length: 0.03, chamferRadius: 0.01), material(PaletteColor(0x5b1f2b)), at: SIMD3(0, 1.12, -0.2))
            cape.simdEulerAngles = SIMD3(0.12, 0, 0)
            root.addChildNode(cape)
        }

        // Head, eyes, hair.
        root.addChildNode(node(SCNSphere(radius: 0.17), skin, at: SIMD3(0, 1.69, 0)))
        for side: Float in [-1, 1] {
            root.addChildNode(node(SCNSphere(radius: 0.023), eyes, at: SIMD3(side * 0.062, 1.71, 0.152)))
        }
        addHair(appearance.hairStyle, material: hair, to: root)

        addGear(origin: origin, job: job, to: root)
        return root
    }

    // MARK: Parts

    @MainActor
    private static func addHair(_ style: HairStyle, material: SCNMaterial, to root: SCNNode) {
        switch style {
        case .short:
            let cap = node(SCNSphere(radius: 0.18), material, at: SIMD3(0, 1.73, -0.02))
            cap.simdScale = SIMD3(1, 0.72, 1)
            root.addChildNode(cap)
        case .long:
            let cap = node(SCNSphere(radius: 0.185), material, at: SIMD3(0, 1.73, -0.02))
            cap.simdScale = SIMD3(1, 0.75, 1)
            root.addChildNode(cap)
            let fall = node(SCNBox(width: 0.34, height: 0.5, length: 0.1, chamferRadius: 0.05), material, at: SIMD3(0, 1.5, -0.12))
            root.addChildNode(fall)
        case .spiky:
            for i in 0..<7 {
                let a = Float(i) / 7 * 2 * .pi
                let spike = node(SCNCone(topRadius: 0, bottomRadius: 0.06, height: 0.2), material, at: SIMD3(sin(a) * 0.1, 1.83, cos(a) * 0.08 - 0.03))
                spike.simdEulerAngles = SIMD3(cos(a) * 0.6 - 0.2, 0, -sin(a) * 0.6)
                root.addChildNode(spike)
            }
            let cap = node(SCNSphere(radius: 0.175), material, at: SIMD3(0, 1.74, -0.02))
            cap.simdScale = SIMD3(1, 0.62, 1)
            root.addChildNode(cap)
        case .tied:
            let cap = node(SCNSphere(radius: 0.18), material, at: SIMD3(0, 1.73, -0.02))
            cap.simdScale = SIMD3(1, 0.72, 1)
            root.addChildNode(cap)
            root.addChildNode(node(SCNSphere(radius: 0.06), material, at: SIMD3(0, 1.78, -0.19)))
            let tail = node(SCNCapsule(capRadius: 0.045, height: 0.36), material, at: SIMD3(0, 1.6, -0.23))
            tail.simdEulerAngles = SIMD3(-0.35, 0, 0)
            root.addChildNode(tail)
        case .shaved:
            let cap = node(SCNSphere(radius: 0.172), material, at: SIMD3(0, 1.72, -0.01))
            cap.simdScale = SIMD3(1, 0.6, 1)
            cap.opacity = 0.55
            root.addChildNode(cap)
        }
    }

    @MainActor
    private static func addGear(origin: PlayerOrigin?, job: BaseJob?, to root: SCNNode) {
        let steel = material(PaletteColor(0xb9c2cc), roughness: 0.3, metalness: 0.8)
        let wood = material(PaletteColor(0x6b4a2e))
        let mainHand = origin?.startingEquipment.first(where: { $0.slot == .mainHand })

        if job == .magician {
            // A plain staff with a glowing focus.
            let staff = node(SCNCylinder(radius: 0.022, height: 1.6), wood, at: SIMD3(0.36, 0.95, 0.12))
            root.addChildNode(staff)
            root.addChildNode(node(SCNSphere(radius: 0.06), material(PaletteColor(0x6fe8ff), emission: 1), at: SIMD3(0.36, 1.78, 0.12)))
        } else if job == .brawler {
            for side: Float in [-1, 1] {
                root.addChildNode(node(SCNSphere(radius: 0.075), material(PaletteColor(0xd9d2c0)), at: SIMD3(side * 0.32, 0.88, 0.01)))
            }
        } else if let item = mainHand {
            switch item.id {
            case EquipmentItem.rustyTwinDaggers.id:
                for side: Float in [-1, 1] {
                    let blade = node(SCNBox(width: 0.03, height: 0.32, length: 0.012, chamferRadius: 0.004), steel, at: SIMD3(side * 0.33, 0.72, 0.05))
                    blade.simdEulerAngles = SIMD3(0.2, 0, side * -0.1)
                    root.addChildNode(blade)
                }
            case EquipmentItem.ironSword.id:
                let blade = node(SCNBox(width: 0.05, height: 1.0, length: 0.014, chamferRadius: 0.005), steel, at: SIMD3(0.34, 0.45, 0.1))
                root.addChildNode(blade)
                root.addChildNode(node(SCNBox(width: 0.2, height: 0.03, length: 0.04, chamferRadius: 0.01), wood, at: SIMD3(0.34, 0.97, 0.1)))
            default:
                let blade = node(SCNBox(width: 0.045, height: 0.68, length: 0.012, chamferRadius: 0.004), steel, at: SIMD3(0.34, 0.58, 0.08))
                root.addChildNode(blade)
            }
        }

        let hasShield = job == .knight || origin?.startingEquipment.contains(where: { $0.slot == .offHand }) == true
        if hasShield {
            let shield = node(SCNCylinder(radius: job == .knight ? 0.3 : 0.2, height: 0.04), wood, at: SIMD3(-0.38, 1.0, 0.08))
            shield.simdEulerAngles = SIMD3(.pi / 2, 0, 0.25)
            root.addChildNode(shield)
            root.addChildNode(node(SCNSphere(radius: 0.04), steel, at: SIMD3(-0.38, 1.0, 0.11)))
        }
        if job == .knight {
            for side: Float in [-1, 1] {
                let pauldron = node(SCNSphere(radius: 0.11), steel, at: SIMD3(side * 0.27, 1.45, 0))
                pauldron.simdScale = SIMD3(1, 0.6, 1)
                root.addChildNode(pauldron)
            }
        }
    }

    // MARK: Helpers

    @MainActor
    static func material(_ color: PaletteColor, roughness: Double = 0.8, metalness: Double = 0, emission: Double = 0) -> SCNMaterial {
        let material = SCNMaterial()
        material.lightingModel = .physicallyBased
        material.diffuse.contents = color.cgColor
        material.roughness.contents = roughness
        material.metalness.contents = metalness
        if emission > 0 {
            material.emission.contents = color.cgColor
            material.emission.intensity = emission
        }
        return material
    }

    @MainActor
    private static func node(_ geometry: SCNGeometry, _ material: SCNMaterial, at position: SIMD3<Float>) -> SCNNode {
        geometry.materials = [material]
        let node = SCNNode(geometry: geometry)
        node.simdPosition = position
        return node
    }
}

extension PaletteColor {
    var cgColor: CGColor {
        CGColor(red: red, green: green, blue: blue, alpha: 1)
    }
}
