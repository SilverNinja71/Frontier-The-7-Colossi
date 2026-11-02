import Foundation

/// Core attributes. Jobs set the base; origins scale them by percentage.
struct Attributes: Equatable, Codable, Sendable {
    var vitality: Int
    var strength: Int
    var dexterity: Int
    var agility: Int
    var intelligence: Int
    var luck: Int
}

/// The first job a pioneer takes. Each branches into advanced jobs later.
enum BaseJob: String, CaseIterable, Identifiable, Codable, Sendable {
    case swordsman
    case mercenary
    case knight
    case brawler
    case thief
    case magician
    case priest
    case blacksmith

    enum Discipline: String, Sendable {
        case combat = "Combat"
        case magic = "Magic"
        case craft = "Crafting"
    }

    var id: String { rawValue }

    var title: String {
        switch self {
        case .swordsman: "Swordsman"
        case .mercenary: "Mercenary"
        case .knight: "Knight"
        case .brawler: "Brawler"
        case .thief: "Thief"
        case .magician: "Magician"
        case .priest: "Priest"
        case .blacksmith: "Blacksmith"
        }
    }

    var discipline: Discipline {
        switch self {
        case .swordsman, .mercenary, .knight, .brawler, .thief: .combat
        case .magician, .priest: .magic
        case .blacksmith: .craft
        }
    }

    var summary: String {
        switch self {
        case .swordsman: "One blade, clean footwork. Rewards precise parries and counters."
        case .mercenary: "Dual blades, high DEX and AGI. Critical hits and mobility."
        case .knight: "Heavy armour and a tower shield. Deflects instead of rolling."
        case .brawler: "Fists and kicks in long chains. Breaks poise fast."
        case .thief: "Smoke, traps and stealth. Never where the enemy swings."
        case .magician: "Elemental spells with mana and chant timing. Area damage."
        case .priest: "Blessings and wards for the party. Burns the undead."
        case .blacksmith: "Forges, sharpens and restores. Wakes ancient machinery."
        }
    }

    /// Advancement path shown in the Azure Void.
    var path: [String] {
        switch self {
        case .swordsman: ["Swordsman", "Sword Master", "Sword Saint"]
        case .mercenary: ["Mercenary", "Twin-Blade Assassin"]
        case .knight: ["Knight", "Paladin", "Fortress Guardian"]
        case .brawler: ["Brawler", "Monk", "Ki Fist"]
        case .thief: ["Thief", "Shadow Runner", "Ninja"]
        case .magician: ["Magician", "Sorcerer", "Sage"]
        case .priest: ["Priest", "Cleric", "Exorcist"]
        case .blacksmith: ["Blacksmith", "Master Craftsman", "Relic Smith"]
        }
    }

    var symbol: String {
        switch self {
        case .swordsman: "line.diagonal"
        case .mercenary: "scissors"
        case .knight: "shield"
        case .brawler: "hand.raised.fingers.spread"
        case .thief: "eye.slash"
        case .magician: "sparkles"
        case .priest: "cross.case"
        case .blacksmith: "hammer"
        }
    }

    var baseAttributes: Attributes {
        switch self {
        case .swordsman: Attributes(vitality: 10, strength: 12, dexterity: 13, agility: 11, intelligence: 6, luck: 8)
        case .mercenary: Attributes(vitality: 8, strength: 9, dexterity: 14, agility: 14, intelligence: 6, luck: 9)
        case .knight: Attributes(vitality: 15, strength: 12, dexterity: 8, agility: 6, intelligence: 6, luck: 8)
        case .brawler: Attributes(vitality: 11, strength: 14, dexterity: 10, agility: 12, intelligence: 4, luck: 9)
        case .thief: Attributes(vitality: 8, strength: 7, dexterity: 13, agility: 15, intelligence: 7, luck: 12)
        case .magician: Attributes(vitality: 7, strength: 5, dexterity: 9, agility: 9, intelligence: 16, luck: 9)
        case .priest: Attributes(vitality: 10, strength: 6, dexterity: 8, agility: 8, intelligence: 14, luck: 9)
        case .blacksmith: Attributes(vitality: 12, strength: 14, dexterity: 12, agility: 6, intelligence: 8, luck: 8)
        }
    }

    /// What the defend input does for this job.
    var defensiveStyle: String {
        switch self {
        case .swordsman, .mercenary: "Parry (12-frame window)"
        case .knight: "Shield deflect"
        case .brawler: "Slip and counter"
        case .thief: "Smoke step"
        case .magician, .priest: "Ward"
        case .blacksmith: "Brace"
        }
    }
}

enum HairStyle: String, CaseIterable, Identifiable, Codable, Sendable {
    case short, long, spiky, tied, shaved
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

/// sRGB colour as plain numbers so profiles stay Codable and platform-neutral.
struct PaletteColor: Hashable, Codable, Sendable, Identifiable {
    let red: Double
    let green: Double
    let blue: Double
    var id: String { "\(red)-\(green)-\(blue)" }

    init(_ hex: UInt32) {
        red = Double((hex >> 16) & 0xff) / 255
        green = Double((hex >> 8) & 0xff) / 255
        blue = Double(hex & 0xff) / 255
    }
}

enum Palette {
    static let hair: [PaletteColor] = [.init(0x1c1712), .init(0x5a3a22), .init(0xb07a3e), .init(0xe2c27a), .init(0xd8dde4), .init(0xa8322b), .init(0x3b4fa8)]
    static let skin: [PaletteColor] = [.init(0xf6d7c0), .init(0xe8b994), .init(0xc68a62), .init(0x9b6542), .init(0x6b4128)]
    static let eyes: [PaletteColor] = [.init(0x3b2a1d), .init(0x3d6fb6), .init(0x3f8a54), .init(0xc29a2b), .init(0x8d3fd1), .init(0xc8343a)]
    static let outfit: [PaletteColor] = [.init(0x7a4b2a), .init(0x2f4d6e), .init(0x3f5c34), .init(0x6e2f35), .init(0x3a3a44), .init(0xd9d2c0)]
}

struct Appearance: Equatable, Codable, Sendable {
    var hairStyle: HairStyle = .short
    var hairColor: PaletteColor = Palette.hair[1]
    var skinTone: PaletteColor = Palette.skin[1]
    var eyeColor: PaletteColor = Palette.eyes[1]
    var outfitColor: PaletteColor = Palette.outfit[1]
}

/// Everything the Azure Void produces.
struct PioneerProfile: Equatable, Codable, Sendable {
    var name: String
    var appearance: Appearance
    var origin: PlayerOrigin
    var job: BaseJob

    /// Job base plus the origin's attribute perks (the rest apply to derived stats).
    var attributes: Attributes {
        let b = origin.bonuses
        var a = job.baseAttributes
        let flat = b.flatAllAttributes
        a.vitality += flat
        a.strength += flat
        a.dexterity += flat
        a.agility += flat
        a.intelligence += flat
        a.luck += flat
        func scale(_ value: Int, _ bonus: Double) -> Int { Int((Double(value) * (1 + bonus)).rounded()) }
        a.luck = scale(a.luck, b.luck)
        a.agility = scale(a.agility, b.agility)
        return a
    }

    /// Derived pools: base from attributes, then the origin's percentage.
    var maxHP: Int {
        Int((Double(60 + attributes.vitality * 12) * (1 + origin.bonuses.maxHP)).rounded())
    }

    var maxMP: Int {
        Int((Double(20 + attributes.intelligence * 8) * (1 + origin.bonuses.maxMana)).rounded())
    }
}

enum NameValidation: Equatable, Sendable {
    case valid
    case tooShort
    case tooLong
    case invalidCharacters
    case reserved

    static let minLength = 3
    static let maxLength = 16
    private static let reservedNames: Set<String> = ["admin", "gm", "moderator", "system", "frontier"]

    static func check(_ raw: String) -> NameValidation {
        let name = raw.trimmingCharacters(in: .whitespaces)
        if name.count < minLength { return .tooShort }
        if name.count > maxLength { return .tooLong }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: " -_'"))
        if name.unicodeScalars.contains(where: { !allowed.contains($0) }) { return .invalidCharacters }
        if name.contains("  ") { return .invalidCharacters }
        if reservedNames.contains(name.lowercased()) { return .reserved }
        return .valid
    }

    var message: String? {
        switch self {
        case .valid: nil
        case .tooShort: "At least \(Self.minLength) characters."
        case .tooLong: "At most \(Self.maxLength) characters."
        case .invalidCharacters: "Letters, numbers, spaces, - _ and ' only."
        case .reserved: "That name is reserved."
        }
    }
}
