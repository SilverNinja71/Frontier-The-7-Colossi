import SceneKit
import SwiftUI

/// Character creation in the Azure Chamber: identity → origin → job → confirm, with the
/// pioneer turning on a glass projection dais in an endless cobalt void (#061121).
struct AzureChamberView: View {
    enum Step: Int, CaseIterable {
        case identity, origin, job, confirm

        var title: String {
            switch self {
            case .identity: "Identity"
            case .origin: "Origin"
            case .job: "Job"
            case .confirm: "Begin"
            }
        }
    }

    let onComplete: (PioneerProfile) -> Void

    @State private var chamber = ChamberScene()
    @State private var step: Step = .identity
    @State private var name = ""
    @State private var appearance = Appearance()
    @State private var origin: PlayerOrigin?
    @State private var job: BaseJob?
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var validation: NameValidation { NameValidation.check(name) }

    private var canAdvance: Bool {
        switch step {
        case .identity: validation == .valid
        case .origin: origin != nil
        case .job: job != nil
        case .confirm: true
        }
    }

    var body: some View {
        ZStack {
            SceneView(scene: chamber.scene, pointOfView: chamber.camera, options: [])
                .ignoresSafeArea()
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { chamber.dragChanged(translationX: $0.translation.width) }
                        .onEnded { _ in chamber.dragEnded() }
                )

            VStack(spacing: 10) {
                Text("FRONTIER OF THE COLOSSI  ·  AZURE CHAMBER")
                    .font(.caption2.weight(.semibold))
                    .tracking(4)
                    .foregroundStyle(Color.white.opacity(0.55))
                    .padding(.top, 14)
                StepHeader(current: step)
                Spacer(minLength: 0)
            }

            panelLayout
        }
        .background(Color(red: 0.02, green: 0.04, blue: 0.1))
        .onAppear { refreshFigure() }
        .onChange(of: appearance) { _, _ in refreshFigure() }
        .onChange(of: origin) { _, _ in refreshFigure() }
        .onChange(of: job) { _, _ in refreshFigure() }
    }

    @ViewBuilder
    private var panelLayout: some View {
        if sizeClass == .compact {
            VStack {
                Spacer()
                panel
                    .frame(maxHeight: 420)
                    .padding(12)
            }
        } else {
            HStack {
                Spacer()
                panel
                    .frame(width: 400)
                    .frame(maxHeight: 640)
                    .padding(.trailing, 28)
                    .padding(.vertical, 70)
            }
        }
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 14) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch step {
                    case .identity: identityStep
                    case .origin: originStep
                    case .job: jobStep
                    case .confirm: confirmStep
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 4)
            }
            .scrollIndicators(.hidden)

            HStack(spacing: 10) {
                if step != .identity {
                    Button("Back") { move(-1) }
                        .buttonStyle(GlassButtonStyle(prominent: false))
                }
                Spacer()
                Button(step == .confirm ? "Enter the world" : "Continue") {
                    if step == .confirm, let origin, let job {
                        onComplete(PioneerProfile(name: name.trimmingCharacters(in: .whitespaces), appearance: appearance, origin: origin, job: job))
                    } else {
                        move(1)
                    }
                }
                .buttonStyle(GlassButtonStyle(prominent: true))
                .disabled(!canAdvance)
            }
        }
        .padding(20)
        .glassPanel()
    }

    // MARK: Steps

    private var identityStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel("Pioneer name")
            TextField("Your name", text: $name)
                .textFieldStyle(.plain)
                .font(.title3.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.white.opacity(validation == .valid || name.isEmpty ? 0.25 : 0.0), lineWidth: 1))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.pink.opacity(validation != .valid && !name.isEmpty ? 0.7 : 0), lineWidth: 1))
                .autocorrectionDisabled()
            Text(name.isEmpty ? "3–16 letters, numbers, spaces, - _ '" : validation.message ?? "Looks good.")
                .font(.caption)
                .foregroundStyle(validation == .valid ? Color.cyan.opacity(0.9) : (name.isEmpty ? Color.white.opacity(0.5) : Color.pink))

            SectionLabel("Hair")
            Picker("Hair style", selection: $appearance.hairStyle) {
                ForEach(HairStyle.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            SwatchRow(colors: Palette.hair, selection: $appearance.hairColor)

            SectionLabel("Skin")
            SwatchRow(colors: Palette.skin, selection: $appearance.skinTone)
            SectionLabel("Eyes")
            SwatchRow(colors: Palette.eyes, selection: $appearance.eyeColor)
            SectionLabel("Outfit")
            SwatchRow(colors: Palette.outfit, selection: $appearance.outfitColor)
        }
    }

    private var originStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Choose your origin")
            Text("Your origin shapes your perks, your first gear and where you wake up.")
                .font(.caption)
                .foregroundStyle(Color.white.opacity(0.6))
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(Array(PlayerOrigin.allCases.enumerated()), id: \.element) { index, candidate in
                    OriginCard(origin: candidate, selected: origin == candidate, delay: Double(index) * 0.35)
                        .onTapGesture { withAnimation(.spring(duration: 0.3)) { origin = candidate } }
                }
            }
            if let origin {
                VStack(alignment: .leading, spacing: 6) {
                    Text(origin.title).font(.headline)
                    Text(origin.traitDescription).font(.subheadline).foregroundStyle(Color.white.opacity(0.85))
                    Text("Starts with: " + origin.startingEquipment.map(\.name).joined(separator: ", "))
                        .font(.caption).foregroundStyle(Color.white.opacity(0.6))
                    Label(origin.spawn.displayName, systemImage: "mappin.and.ellipse")
                        .font(.caption).foregroundStyle(Color.cyan.opacity(0.9))
                    if let warning = origin.warning {
                        Label(warning, systemImage: "exclamationmark.triangle")
                            .font(.caption).foregroundStyle(Color.orange)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private var jobStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Choose your first job")
            ForEach(BaseJob.allCases) { candidate in
                JobRow(job: candidate, selected: job == candidate)
                    .onTapGesture { withAnimation(.spring(duration: 0.3)) { job = candidate } }
            }
        }
    }

    private var confirmStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Your pioneer")
            Text(name).font(.largeTitle.weight(.semibold))
            if let origin, let job {
                let profile = PioneerProfile(name: name, appearance: appearance, origin: origin, job: job)
                HStack(spacing: 8) {
                    Tag(text: origin.title, symbol: origin.symbol)
                    Tag(text: job.title, symbol: job.symbol)
                }
                AttributeGrid(attributes: profile.attributes)
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(origin.bonuses.summaryLines, id: \.self) { line in
                        Label(line, systemImage: "sparkle").font(.caption).foregroundStyle(Color.cyan)
                    }
                    Label(job.defensiveStyle, systemImage: "shield.lefthalf.filled").font(.caption).foregroundStyle(Color.white.opacity(0.75))
                    Label("Wakes at: \(origin.spawn.displayName)", systemImage: "mappin.and.ellipse").font(.caption).foregroundStyle(Color.white.opacity(0.75))
                }
            }
        }
    }

    // MARK: Helpers

    private func move(_ delta: Int) {
        guard let next = Step(rawValue: step.rawValue + delta) else { return }
        withAnimation(.easeInOut(duration: 0.25)) { step = next }
    }

    private func refreshFigure() {
        chamber.show(appearance: appearance, origin: origin, job: job)
    }
}

// MARK: - Components

private struct StepHeader: View {
    let current: AzureChamberView.Step

    var body: some View {
        HStack(spacing: 10) {
            ForEach(AzureChamberView.Step.allCases, id: \.self) { step in
                HStack(spacing: 6) {
                    Circle()
                        .fill(step.rawValue <= current.rawValue ? Color.cyan : Color.white.opacity(0.25))
                        .frame(width: 7, height: 7)
                        .shadow(color: Color.cyan.opacity(step == current ? 0.9 : 0), radius: 6)
                    Text(step.title.uppercased())
                        .font(.caption2.weight(.semibold))
                        .tracking(2)
                        .foregroundStyle(step == current ? Color.white : Color.white.opacity(0.45))
                }
                if step != .confirm {
                    Rectangle().fill(Color.white.opacity(0.2)).frame(width: 18, height: 1)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .glassPanel(cornerRadius: 999)
    }
}

private struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(2.5)
            .foregroundStyle(Color.white.opacity(0.55))
    }
}

private struct SwatchRow: View {
    let colors: [PaletteColor]
    @Binding var selection: PaletteColor

    var body: some View {
        HStack(spacing: 10) {
            ForEach(colors) { color in
                Circle()
                    .fill(Color(red: color.red, green: color.green, blue: color.blue))
                    .frame(width: 28, height: 28)
                    .overlay(Circle().strokeBorder(Color.white.opacity(selection == color ? 1 : 0.2), lineWidth: selection == color ? 2 : 1))
                    .shadow(color: Color.cyan.opacity(selection == color ? 0.7 : 0), radius: 6)
                    .onTapGesture { selection = color }
                    .accessibilityAddTraits(selection == color ? .isSelected : [])
            }
        }
    }
}

/// Glassy origin card that floats gently, out of phase with its neighbours.
private struct OriginCard: View {
    let origin: PlayerOrigin
    let selected: Bool
    let delay: Double
    @State private var lifted = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: origin.symbol)
                .font(.title3)
                .foregroundStyle(selected ? Color.cyan : Color.white.opacity(0.85))
            Text(origin.title)
                .font(.subheadline.weight(.semibold))
            Text(origin.tagline)
                .font(.caption2)
                .foregroundStyle(Color.white.opacity(0.6))
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(selected ? Color.cyan : Color.white.opacity(0.22), lineWidth: selected ? 1.5 : 0.75)
        )
        .shadow(color: Color.cyan.opacity(selected ? 0.55 : 0), radius: 14)
        .scaleEffect(selected ? 1.03 : 1)
        .offset(y: lifted ? -3 : 3)
        .onAppear {
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true).delay(delay)) { lifted = true }
        }
        .contentShape(Rectangle())
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct JobRow: View {
    let job: BaseJob
    let selected: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: job.symbol)
                .font(.title3)
                .frame(width: 32)
                .foregroundStyle(selected ? Color.cyan : Color.white.opacity(0.85))
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(job.title).font(.subheadline.weight(.semibold))
                    Text(job.discipline.rawValue.uppercased())
                        .font(.caption2.weight(.bold)).tracking(1.5)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.white.opacity(0.08), in: Capsule())
                        .foregroundStyle(Color.white.opacity(0.6))
                }
                Text(job.summary).font(.caption).foregroundStyle(Color.white.opacity(0.65))
                Text(job.path.joined(separator: "  →  "))
                    .font(.caption2).foregroundStyle(Color.cyan.opacity(0.8))
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(selected ? Color.cyan : Color.white.opacity(0.18), lineWidth: selected ? 1.5 : 0.75))
        .shadow(color: Color.cyan.opacity(selected ? 0.45 : 0), radius: 10)
        .contentShape(Rectangle())
    }
}

private struct Tag: View {
    let text: String
    let symbol: String

    var body: some View {
        Label(text, systemImage: symbol)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Color.white.opacity(0.08), in: Capsule())
            .overlay(Capsule().strokeBorder(Color.white.opacity(0.25), lineWidth: 0.75))
    }
}

private struct AttributeGrid: View {
    let attributes: Attributes

    var body: some View {
        let rows: [(String, Int)] = [
            ("VIT", attributes.vitality), ("STR", attributes.strength), ("DEX", attributes.dexterity),
            ("AGI", attributes.agility), ("INT", attributes.intelligence), ("LUC", attributes.luck),
        ]
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
            ForEach(rows, id: \.0) { label, value in
                VStack(spacing: 2) {
                    Text(label).font(.caption2.weight(.bold)).tracking(1.5).foregroundStyle(Color.white.opacity(0.5))
                    Text("\(value)").font(.title3.monospacedDigit().weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

// MARK: - Glass style

struct GlassButtonStyle: ButtonStyle {
    let prominent: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .tracking(1)
            .padding(.horizontal, 20)
            .padding(.vertical, 11)
            .foregroundStyle(prominent ? Color(red: 0.02, green: 0.08, blue: 0.16) : Color.white)
            .background {
                if prominent {
                    Capsule().fill(LinearGradient(colors: [Color(red: 0.6, green: 0.95, blue: 1), .cyan], startPoint: .top, endPoint: .bottom))
                } else {
                    Capsule().fill(.ultraThinMaterial)
                }
            }
            .overlay(Capsule().strokeBorder(Color.white.opacity(prominent ? 0.7 : 0.3), lineWidth: 1))
            .shadow(color: Color.cyan.opacity(prominent && isEnabled ? 0.5 : 0), radius: 12)
            .opacity(isEnabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension View {
    /// Translucent glass with a fine glowing hairline border.
    func glassPanel(cornerRadius: CGFloat = 24) -> some View {
        background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(
                        LinearGradient(colors: [Color.white.opacity(0.55), Color.white.opacity(0.12), Color.cyan.opacity(0.35)], startPoint: .topLeading, endPoint: .bottomTrailing),
                        lineWidth: 1
                    )
            )
            .shadow(color: Color.cyan.opacity(0.18), radius: 24)
    }
}
