import Foundation

/// Modifiers granted by an origin, applied on top of the job's base attributes.
/// Fractions: 0.15 means +15%; negative values are reductions.
struct AttributeBonuses: Equatable, Codable, Sendable {
    var luck: Double = 0
    var vitality: Double = 0
    var agility: Double = 0
    var maxMana: Double = 0
    var castSpeed: Double = 0
    var physicalDefense: Double = 0
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
            ("Vitality & HP", vitality),
            ("Agility", agility),
            ("Max Mana", maxMana),
            ("Cast Speed", castSpeed),
            ("Physical Defense", physicalDefense),
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
    case brambleWilds
    case bastionSquare
    case bastionGarrison
    case bastionTrainingGrounds

    var displayName: String {
        switch self {
        case .brambleWilds: "The Bramble Wilds — edge of the Gloamwood"
        case .bastionSquare: "The First Bastion — Town Square"
        case .bastionGarrison: "The First Bastion — Garrison"
        case .bastionTrainingGrounds: "The First Bastion — Training Grounds"
        }
    }

    /// Feet position in world space.
    var position: SIMD3<Float> {
        switch self {
        case .brambleWilds: SIMD3(-150, 0, -14)
        case .bastionSquare: SIMD3(0, 0, 7)
        case .bastionGarrison: SIMD3(6, 0, 42)
        case .bastionTrainingGrounds: SIMD3(0, 0, 12)
        }
    }

    /// True when the pioneer starts outside the town walls (no tutorial safety net).
    var skipsTown: Bool { self == .brambleWilds }
}

/// The background a pioneer chooses in the Azure Chamber. Each sets passive bonuses,
/// starting equipment and where the adventure begins.
enum PlayerOrigin: String, CaseIterable, Identifiable, Codable, Sendable {
    case drifter
    case nobleBlood
    case untamedHero
    case beastChild
    case bladeDisciple
    case commoner
    case optimist
    case opportunist

    var id: String { rawValue }

    var title: String {
        switch self {
        case .drifter: "The Drifter"
        case .nobleBlood: "Noble Blood"
        case .untamedHero: "Untamed Hero"
        case .beastChild: "Beast Child"
        case .bladeDisciple: "Blade Disciple"
        case .commoner: "Commoner"
        case .optimist: "Optimist"
        case .opportunist: "Opportunist"
        }
    }

    /// One line of flavour for the card.
    var tagline: String {
        switch self {
        case .drifter: "Masterless, townless. Just the wilds and two blunt knives."
        case .nobleBlood: "Old blood carries old power — and a talent for spellwork."
        case .untamedHero: "A local champion, raised rough beyond the walls."
        case .beastChild: "Raised among beasts. They barely notice you."
        case .bladeDisciple: "Devoted to the blade since you could stand."
        case .commoner: "Nobody special — which means good at a little of everything."
        case .optimist: "Bad luck slides right off you."
        case .opportunist: "Every deal has an angle, and you always find it."
        }
    }

    /// The trait as rules text.
    var traitDescription: String {
        switch self {
        case .drifter: "+15% Luck: bigger critical hits and better rare drops. Skips the First Bastion: wakes in the wilds with only twin daggers."
        case .nobleBlood: "+10% Max Mana and +15% cast speed."
        case .untamedHero: "+10% Vitality and HP, +5% physical defense."
        case .beastChild: "+10% Agility, sprinting costs 20% less stamina, monsters notice you 25% closer."
        case .bladeDisciple: "+10% attack speed with swords and daggers. Starts with an Iron Sword."
        case .commoner: "+3 to every base attribute. Flexible to build in any direction."
        case .optimist: "Debuffs on you wear off 25% sooner."
        case .opportunist: "15% discount at every town vendor."
        }
    }

    var bonuses: AttributeBonuses {
        switch self {
        case .drifter: AttributeBonuses(luck: 0.15)
        case .nobleBlood: AttributeBonuses(maxMana: 0.10, castSpeed: 0.15)
        case .untamedHero: AttributeBonuses(vitality: 0.10, physicalDefense: 0.05)
        case .beastChild: AttributeBonuses(agility: 0.10, sprintStaminaCost: -0.20, aggroRadius: -0.25)
        case .bladeDisciple: AttributeBonuses(bladeAttackSpeed: 0.10)
        case .commoner: AttributeBonuses(flatAllAttributes: 3)
        case .optimist: AttributeBonuses(debuffDuration: -0.25)
        case .opportunist: AttributeBonuses(vendorDiscount: 0.15)
        }
    }

    var startingEquipment: [EquipmentItem] {
        switch self {
        case .drifter: [.rustyTwinDaggers, .clothShorts] // as close to nothing as decency allows
        case .nobleBlood: [.apprenticeWand, .travelersTunic, .travelersTrousers, .signetRing]
        case .untamedHero: [.shortSword, .huntersWraps, .travelersTrousers]
        case .beastChild: [.rustyTwinDaggers, .huntersWraps, .travelersTrousers]
        case .bladeDisciple: [.ironSword, .travelersTunic, .travelersTrousers]
        case .commoner, .opportunist: [.shortSword, .travelersTunic, .travelersTrousers]
        case .optimist: [.shortSword, .travelersTunic, .travelersTrousers, .luckyCoin]
        }
    }

    var spawn: SpawnPoint {
        switch self {
        case .drifter: .brambleWilds
        case .nobleBlood, .commoner, .optimist, .opportunist: .bastionSquare
        case .untamedHero: .bastionGarrison
        case .beastChild, .bladeDisciple: .bastionTrainingGrounds
        }
    }

    /// SF Symbol for the card.
    var symbol: String {
        switch self {
        case .drifter: "figure.hiking"
        case .nobleBlood: "crown"
        case .untamedHero: "flame"
        case .beastChild: "pawprint"
        case .bladeDisciple: "bolt.horizontal"
        case .commoner: "house"
        case .optimist: "sun.max"
        case .opportunist: "theatermasks"
        }
    }

    /// Hard mode: a warning shown on the card.
    var warning: String? {
        self == .drifter ? "Hard start: no town, no armour, starter daggers only." : nil
    }
}
