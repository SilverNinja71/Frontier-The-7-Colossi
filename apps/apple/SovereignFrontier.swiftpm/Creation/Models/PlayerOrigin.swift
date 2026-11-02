import Foundation

/// Modifiers granted by an origin, applied on top of the job's base attributes.
/// Fractions: 0.15 means +15%; negative values are reductions.
struct AttributeBonuses: Equatable, Codable, Sendable {
    var luck: Double = 0
    var maxHP: Double = 0
    var agility: Double = 0
    var maxMana: Double = 0
    var castSpeed: Double = 0
    /// Resistance to being staggered: shortens hit-stun by the same share.
    var poise: Double = 0
    var bladeAttackSpeed: Double = 0
    /// Stamina spent while sprinting. -0.2 = sprinting costs 20% less.
    var sprintStaminaCost: Double = 0
    /// Radius at which monsters notice the player. -0.25 = noticed 25% closer.
    var aggroRadius: Double = 0
    /// Length of debuffs on the player. -0.25 = they wear off 25% sooner.
    var debuffDuration: Double = 0
    /// Discount at town vendors.
    var vendorDiscount: Double = 0
    /// Flat points added to every base attribute.
    var flatAllAttributes: Int = 0

    static let none = AttributeBonuses()

    /// Human-readable lines for the origin cards, largest effects first.
    var summaryLines: [String] {
        let entries: [(String, Double)] = [
            ("Luck", luck),
            ("Max HP", maxHP),
            ("Agility", agility),
            ("Max Mana", maxMana),
            ("Cast Speed", castSpeed),
            ("Physical Poise", poise),
            ("Sword & Dagger Speed", bladeAttackSpeed),
            ("Sprint Stamina Cost", sprintStaminaCost),
            ("Monster Notice Radius", aggroRadius),
            ("Debuff Duration", debuffDuration),
            ("Vendor Prices", -vendorDiscount),
        ]
        var lines = entries
            .filter { $0.1 != 0 }
            .sorted { abs($0.1) > abs($1.1) }
            .map { name, value in
                let percent = Int((value * 100).rounded())
                return "\(percent > 0 ? "+" : "")\(percent)% \(name)"
            }
        if flatAllAttributes != 0 { lines.insert("+\(flatAllAttributes) to every attribute", at: 0) }
        return lines
    }
}

enum EquipmentSlot: String, Codable, Sendable {
    case mainHand, offHand, body, legs, accessory
}

struct EquipmentItem: Identifiable, Equatable, Codable, Sendable {
    let id: String
    let name: String
    let slot: EquipmentSlot
    let attack: Int
    let defense: Int
    /// Matches a moveset id in the shared combat data (see packages/combat-math).
    let movesetID: String?

    static let rustyTwinDaggers = EquipmentItem(id: "rusty-twin-daggers", name: "Rusty Twin Daggers", slot: .mainHand, attack: 9, defense: 0, movesetID: "twin-fangs")
    static let clothShorts = EquipmentItem(id: "cloth-shorts", name: "Cloth Shorts", slot: .legs, attack: 0, defense: 1, movesetID: nil)
    static let travelersTunic = EquipmentItem(id: "travelers-tunic", name: "Traveler's Tunic", slot: .body, attack: 0, defense: 3, movesetID: nil)
    static let travelersTrousers = EquipmentItem(id: "travelers-trousers", name: "Traveler's Trousers", slot: .legs, attack: 0, defense: 2, movesetID: nil)
    static let shortSword = EquipmentItem(id: "short-sword", name: "Short Sword", slot: .mainHand, attack: 12, defense: 0, movesetID: "sword")
    static let oakBuckler = EquipmentItem(id: "oak-buckler", name: "Oak Buckler", slot: .offHand, attack: 0, defense: 8, movesetID: nil)
    static let ironSword = EquipmentItem(id: "iron-sword", name: "Iron Sword", slot: .mainHand, attack: 18, defense: 0, movesetID: "sword")
    static let apprenticeWand = EquipmentItem(id: "apprentice-wand", name: "Apprentice Wand", slot: .mainHand, attack: 6, defense: 0, movesetID: "wand")
    static let signetRing = EquipmentItem(id: "signet-ring", name: "Family Signet Ring", slot: .accessory, attack: 0, defense: 1, movesetID: nil)
    static let huntersWraps = EquipmentItem(id: "hunters-wraps", name: "Hunter's Wraps", slot: .body, attack: 0, defense: 2, movesetID: nil)
    static let luckyCoin = EquipmentItem(id: "lucky-coin", name: "Lucky Coin", slot: .accessory, attack: 0, defense: 0, movesetID: nil)
}

/// Where a new pioneer first opens their eyes. Coordinates are in the shared world space
/// (metres, +x east, -z north; see apps/client/src/world/geography.ts).
enum SpawnPoint: String, Codable, Sendable {
    case bramblePrimeval
    case bastionPlaza
    case bastionGarrison
    case bastionTrainingGrounds

    var displayName: String {
        switch self {
        case .bramblePrimeval: "The Bramble Primeval — edge of the Gloamwood"
        case .bastionPlaza: "The First Bastion — Plaza"
        case .bastionGarrison: "The First Bastion — Garrison"
        case .bastionTrainingGrounds: "The First Bastion — Training Grounds"
        }
    }

    /// Feet position in world space.
    var position: SIMD3<Float> {
        switch self {
        case .bramblePrimeval: SIMD3(-150, 0, -14)
        case .bastionPlaza: SIMD3(0, 0, 7)
        case .bastionGarrison: SIMD3(6, 0, 42)
        case .bastionTrainingGrounds: SIMD3(0, 0, 12)
        }
    }

    /// True when the pioneer starts outside the town walls (no tutorial safety net).
    var skipsTown: Bool { self == .bramblePrimeval }
}

/// The background a pioneer chooses in the Azure Void. Each sets passive bonuses,
/// starting equipment and where the adventure begins.
enum PlayerOrigin: String, CaseIterable, Identifiable, Codable, Sendable {
    case drifter
    case nobleBlood
    case unbroken
    case feralScion
    case bladeDisciple
    case pragmatist
    case resolute
    case merchant

    var id: String { rawValue }

    var title: String {
        switch self {
        case .drifter: "The Drifter"
        case .nobleBlood: "Noble Blood"
        case .unbroken: "The Unbroken"
        case .feralScion: "Feral Scion"
        case .bladeDisciple: "Blade Disciple"
        case .pragmatist: "The Pragmatist"
        case .resolute: "The Resolute"
        case .merchant: "The Merchant"
        }
    }

    /// One line of flavour for the slate.
    var tagline: String {
        switch self {
        case .drifter: "Masterless, townless. Just the wilds and two blunt knives."
        case .nobleBlood: "Old blood carries old power — and a talent for spellwork."
        case .unbroken: "Knocked down a hundred times. Got up a hundred and one."
        case .feralScion: "Raised among beasts. They barely notice you."
        case .bladeDisciple: "Devoted to the blade since you could stand."
        case .pragmatist: "No talent in particular — and no weakness either."
        case .resolute: "Poison, fear, frost: none of it holds you for long."
        case .merchant: "Every deal has an angle, and you always find it."
        }
    }

    /// The trait as rules text.
    var traitDescription: String {
        switch self {
        case .drifter: "+15% Luck: bigger critical hits and better rare drops. Skips the First Bastion: wakes in the Bramble Primeval with only shorts and twin daggers."
        case .nobleBlood: "+10% Max MP and +15% cast speed."
        case .unbroken: "+10% Max HP and +5% physical poise (shorter stagger)."
        case .feralScion: "+10% Agility, sprinting drains 20% less stamina, monsters notice you 25% closer."
        case .bladeDisciple: "+10% attack speed with swords and daggers. Starts with an Iron Sword."
        case .pragmatist: "+3 to every base attribute. A balanced all-rounder."
        case .resolute: "Debuffs on you wear off 25% sooner."
        case .merchant: "15% discount at every NPC vendor."
        }
    }

    var bonuses: AttributeBonuses {
        switch self {
        case .drifter: AttributeBonuses(luck: 0.15)
        case .nobleBlood: AttributeBonuses(maxMana: 0.10, castSpeed: 0.15)
        case .unbroken: AttributeBonuses(maxHP: 0.10, poise: 0.05)
        case .feralScion: AttributeBonuses(agility: 0.10, sprintStaminaCost: -0.20, aggroRadius: -0.25)
        case .bladeDisciple: AttributeBonuses(bladeAttackSpeed: 0.10)
        case .pragmatist: AttributeBonuses(flatAllAttributes: 3)
        case .resolute: AttributeBonuses(debuffDuration: -0.25)
        case .merchant: AttributeBonuses(vendorDiscount: 0.15)
        }
    }

    var startingEquipment: [EquipmentItem] {
        switch self {
        case .drifter: [.rustyTwinDaggers, .clothShorts] // as close to nothing as decency allows
        case .nobleBlood: [.apprenticeWand, .travelersTunic, .travelersTrousers, .signetRing]
        case .unbroken: [.shortSword, .oakBuckler, .huntersWraps, .travelersTrousers]
        case .feralScion: [.rustyTwinDaggers, .huntersWraps, .travelersTrousers]
        case .bladeDisciple: [.ironSword, .travelersTunic, .travelersTrousers]
        case .pragmatist, .resolute: [.shortSword, .travelersTunic, .travelersTrousers]
        case .merchant: [.shortSword, .travelersTunic, .travelersTrousers, .luckyCoin]
        }
    }

    var spawn: SpawnPoint {
        switch self {
        case .drifter: .bramblePrimeval
        case .nobleBlood, .pragmatist, .resolute, .merchant: .bastionPlaza
        case .unbroken: .bastionGarrison
        case .feralScion, .bladeDisciple: .bastionTrainingGrounds
        }
    }

    /// SF Symbol for the slate.
    var symbol: String {
        switch self {
        case .drifter: "figure.hiking"
        case .nobleBlood: "crown"
        case .unbroken: "flame"
        case .feralScion: "pawprint"
        case .bladeDisciple: "bolt.horizontal"
        case .pragmatist: "scalemass"
        case .resolute: "mountain.2"
        case .merchant: "bag"
        }
    }

    /// Hard mode: a warning shown on the card.
    var warning: String? {
        self == .drifter ? "Hard start: no town, no armour, starter daggers only." : nil
    }
}
