# Frontier: The 7 Colossi — 1,000-Problem World, Lore & Technical Audit

Comprehensive audit of the current Roblox Studio build (`Place1`) against the **Shangri-La Frontier** canon wiki (`https://wikiwiki.jp/syanhuro/`) and player experience standards. Every section contains **100 specific issues** and what each element is **supposed to be**.

## 1. Crystal Areas (Crystal Nest Cliff, Canyon of the Ancient Souls, Prismatic Forest Grotto, Eighthold)

1. **Problem:** Crystal Nest Cliff (`水晶巣崖`) sits on a single flat sand plateau at `(245, 168, -880)` instead of spanning both upper cliff ridges flanking Canyon of the Ancient Souls.  
   **Supposed to be:** Two towering crystal-encrusted cliff ridges overlooking the gorge.
2. **Problem:** Only 6 identical cloned `Mesh_CrystalCluster` models exist in `CrystalNestCliff_WikiAccurate`.  
   **Supposed to be:** Hundreds of varied mineral spires, shelves, and crystal-encrusted rock strata.
3. **Problem:** Zero ground-covering crystal crust ('Crystal Hell' / 水晶地獄) across the cliff surface.  
   **Supposed to be:** Dense crystal floor formed from centuries of Crystal Scorpion shells and ore.
4. **Problem:** Terrain beneath Crystal Nest Cliff is smooth `Sand` instead of jagged `Slate`/`Rock` mineral cliff.  
   **Supposed to be:** Craggy dark rock and quartz-veined cliff ledges.
5. **Problem:** 2 ungrounded/floating parts (`ungrounded = 2`) exist in `CrystalNestCliff_WikiAccurate`.  
   **Supposed to be:** All structures and mineral formations anchored solidly into cliff terrain.
6. **Problem:** Vertical span `Y = 18.0..212.2` mixes canyon-floor bridge parts with high-cliff clusters in one folder.  
   **Supposed to be:** Separate `CanyonOfTheAncientSouls` and `CrystalNestCliff` biome folders.
7. **Problem:** 2 `Sandstone` and 6 `Plastic` primitive parts remain in `CrystalNestCliff_WikiAccurate`.  
   **Supposed to be:** Sculpted stone, rope/chain, and translucent crystal materials.
8. **Problem:** Left `CrystalCluster` base overhangs empty air past the terrain lip.  
   **Supposed to be:** Flush terrain-embedded crystal roots and supporting rock outcrops.
9. **Problem:** No crystal-ore veins or mineral strata visible in cliff walls.  
   **Supposed to be:** Layered glowing quartz/sapphire veins running through the rock face.
10. **Problem:** No Crystal Scorpion nest burrows or crystal-lined hollows.  
   **Supposed to be:** Cracked crystal dens where Crystal Scorpions emerge.
11. **Problem:** No vertical traversal tiers or perilous narrow ledges (`移動難易度は非常に高い`).  
   **Supposed to be:** Multi-tiered narrow cliff paths with fall hazards.
12. **Problem:** No floor crystal spike hazards obstructing movement.  
   **Supposed to be:** Ankle-to-waist-high sharp crystal clusters requiring careful footing.
13. **Problem:** Uniform cyan-blue crystal tint across all 6 clusters.  
   **Supposed to be:** Mixed clear quartz, sapphire, amethyst, and golden (`Goldie Scorpion`) clusters.
14. **Problem:** Opaque mesh shading with no translucent crystal refraction.  
   **Supposed to be:** Translucent `Glass`/crystal outer facets over glowing inner cores.
15. **Problem:** No drifting mineral dust or crystal shimmer particles.  
   **Supposed to be:** Subtle ambient sparkle/refraction particles across the cliff.
16. **Problem:** Crystals only point vertically on flat ground instead of jutting diagonally from cliff faces.  
   **Supposed to be:** Angled crystal spires erupting horizontally and diagonally from cliff walls.
17. **Problem:** No shattered crystal debris scattered around combat zones.  
   **Supposed to be:** Broken crystal shards and fragments littering scorpion territory.
18. **Problem:** Missing **Elder Crystal Scorpion (`水晶群老蠍`)** boss/mini-boss spawn.  
   **Supposed to be:** Large ancient multi-plated Crystal Scorpion mini-boss guarding the upper nest.
19. **Problem:** Only 1 generic `Lv. 99 SUPER RARE Gold Crystal Scorpion` instead of **Goldie Scorpion (`金晶独蠍`) / Golden Age (`皇金世代`)**.  
   **Supposed to be:** Unique/rare golden-carapace scorpion with distinct golden-nest territory and drops.
20. **Problem:** Crystal Scorpions lack magic/beam refraction or carapace reflection mechanics.  
   **Supposed to be:** Crystal shells deflect/refract magic and light attacks.
21. **Problem:** No harvestable crystal-ore mining nodes (`ProximityPrompt`) on the cliff.  
   **Supposed to be:** Interactive crystal veins yielding Crystal Scorpion Ore & Shards.
22. **Problem:** No warning markers or Pioneer lore signs at the cliff approach.  
   **Supposed to be:** Warning markers noting the hidden danger zone.
23. **Problem:** No climbing ledges or crystal-ramp path connecting the canyon floor to the upper cliff.  
   **Supposed to be:** Navigable ascent route from Canyon of the Ancient Souls up to the nests.
24. **Problem:** Only a single `CanyonAncientSouls_SuspensionBridge` with `Plastic` parts.  
   **Supposed to be:** Weathered wood-and-iron suspension bridge spanning a true chasm.
25. **Problem:** No respawn/retreat safe boundary near the cliff approach.  
   **Supposed to be:** Clear safe-zone shrine before entering Crystal Hell.
26. **Problem:** Midday bright skybox does not shift to crystalline glare/refraction.  
   **Supposed to be:** Localized lighting/atmosphere shift with crisp specular highlights.
27. **Problem:** No crystallized scorpion carcass props forming the terrain.  
   **Supposed to be:** Half-crystallized shed carapaces embedded in the cliff.
28. **Problem:** No small (`1–3` stud) or medium (`8–15` stud) crystal clusters blending around large spires.  
   **Supposed to be:** Multi-scale crystal clustering from tiny shards to towering spires.
29. **Problem:** Hard stair-stepped terrain edge right beside the central crystal cluster.  
   **Supposed to be:** Natural eroded cliff geometry.
30. **Problem:** No mineral runoff stream or cliffside cascade.  
   **Supposed to be:** Crystal-tinted runoff spilling into the canyon below.
31. **Problem:** Abrupt terrain transition between Fourfolkshire (`520, -780`) and Crystal Nest Cliff (`245, -880`).  
   **Supposed to be:** Gradual rocky ascent and mountain pass.
32. **Problem:** No hidden-area discovery popup or XP/log reward upon reaching Crystal Nest Cliff.  
   **Supposed to be:** Hidden-area discovery trigger and Pioneer log entry.
33. **Problem:** No crystal loot table (`Crystal Carapace`, `Goldie Shard`) wired in `SLFServer`.  
   **Supposed to be:** Dedicated crystal crafting materials and rare drops.
34. **Problem:** Sheer smooth `Sand` drop-offs instead of `Rock`/`Basalt` cliff faces.  
   **Supposed to be:** Textured `Rock`/`Basalt` vertical cliff faces.
35. **Problem:** Canyon view upward does not frame twin crystal-crowned cliffs.  
   **Supposed to be:** Dramatic upward sightline to glowing crystal ridges on both sides.
36. **Problem:** `Canyon of the Ancient Souls` has no dedicated folder in `BiomesFloraAndMining`.  
   **Supposed to be:** Standalone `CanyonOfTheAncientSouls` folder.
37. **Problem:** `CanyonAncientSouls_SuspensionBridge` uses `Plastic` and `Sandstone` blocks.  
   **Supposed to be:** Detailed plank, cable, and stone-pylon bridge.
38. **Problem:** Terrain at `(150, 168, -880)` is the same `Y = 168` elevation as Crystal Nest Cliff instead of a deep gorge.  
   **Supposed to be:** Deeply carved valley (`Y ~ 60–80`) between `Y ~ 170+` cliffs.
39. **Problem:** No ancient craftsman (`古匠`) ruins, carved pillars, or soul shrines in the canyon.  
   **Supposed to be:** Weathered ancient stone pillars and forgotten forge/shrine ruins.
40. **Problem:** No canyon river or valley mist at the gorge bottom.  
   **Supposed to be:** Winding stream and low-lying mist along the canyon floor.
41. **Problem:** Zero canyon-floor enemy spawns.  
   **Supposed to be:** Gorge-patrolling monsters between Fourfolkshire and Eighthold.
42. **Problem:** Suspension bridge spans almost no vertical drop.  
   **Supposed to be:** High suspension crossing over a deep canyon chasm.
43. **Problem:** Road from Fourfolkshire to Eighthold does not visibly thread through the canyon.  
   **Supposed to be:** Continuous stone/dirt road running through the gorge.
44. **Problem:** No stone archways marking entry/exit of the canyon.  
   **Supposed to be:** Weathered canyon gate arches.
45. **Problem:** No fallen crystal shards littering the canyon floor.  
   **Supposed to be:** Broken crystal chunks fallen from the cliffs above.
46. **Problem:** No canyon-floor rest camp or Pioneer signpost.  
   **Supposed to be:** Small sheltered camp and directional signposts.
47. **Problem:** Bridge has 2 ungrounded anchor parts.  
   **Supposed to be:** Grounded stone bridgehead foundations on both canyon rims.
48. **Problem:** No rope handrails or walkable plank detailing on the bridge.  
   **Supposed to be:** Full rope/chain guardrails and spaced timber planks.
49. **Problem:** Canyon walls lack scree slopes or talus boulders at their base.  
   **Supposed to be:** Natural rockfall talus along cliff bases.
50. **Problem:** No shadow/lighting contrast inside the deep gorge.  
   **Supposed to be:** Cool shadowed gorge floor contrasting with sunlit upper cliffs.
51. **Problem:** Western canyon exit does not connect cleanly to Ruins of Past Glories (`-600, -800`).  
   **Supposed to be:** Clear road/pass leading west to the Ruins.
52. **Problem:** `Canyon of the Ancient Souls` (`150, -880`, r=220) and `Crystal Nest Cliff` (`245, -880`, r=260) overlap almost 100%.  
   **Supposed to be:** Distinct horizontal and vertical zone separation.
53. **Problem:** No ancient stone tablets or lore plaques in the canyon.  
   **Supposed to be:** Interactable lore tablets hinting at Crystal Nest Cliff above.
54. **Problem:** No ambient wind/echo audio zone in the gorge.  
   **Supposed to be:** Spatial canyon wind and water ambience.
55. **Problem:** No canyon waterfall feeding the valley stream.  
   **Supposed to be:** Cliffside waterfall plunging into the canyon.
56. **Problem:** `PrismaticForestGrotto_Cavern` has literally 3 parts (`EntranceArchL`, `EntranceArchR`, `PortalBeacon`).  
   **Supposed to be:** Full multi-chamber subterranean cavern.
57. **Problem:** Prismatic Forest Grotto sits in open daylight instead of underground.  
   **Supposed to be:** Enclosed subterranean cave beneath the mountain ridge.
58. **Problem:** No cavern ceiling, stalactites, or rock walls.  
   **Supposed to be:** Vaulted stone cavern dome with stalactites and natural pillars.
59. **Problem:** Zero bioluminescent moss (`自ら光る苔`) illuminating the cave.  
   **Supposed to be:** Glowing cyan/violet/emerald moss blanketing walls and ceiling.
60. **Problem:** Zero subterranean jungle trees (`樹海のように植物が生い茂り`).  
   **Supposed to be:** Lush underground forest of giant roots, vines, and canopy trees.
61. **Problem:** Zero multicolored flowers (`色とりどりの花`) on the cavern floor.  
   **Supposed to be:** Dense vibrant flower beds carpeting the grotto floor.
62. **Problem:** No iridescent prism/crystal accents inside the grotto.  
   **Supposed to be:** Subtle glowing crystal clusters reflecting the bioluminescent moss.
63. **Problem:** Missing **Crown Spider (`クラウンスパイダー`)** area boss.  
   **Supposed to be:** Giant Crown Spider boss in the central web chamber.
64. **Problem:** Missing **Empire Bee (`エンパイアビー`)** and **Empire Bee Princess** rare enemy.  
   **Supposed to be:** Bee hive chamber with patrolling Empire Bees and Princess spawn.
65. **Problem:** Missing **Quad Beetle (`クアッドビートル"一騎討千"`)** extraordinary enemy.  
   **Supposed to be:** Four-horned giant beetle boss encounter.
66. **Problem:** No branching labyrinthine cave tunnels (`巨大な迷宮洞窟`).  
   **Supposed to be:** Multi-path underground maze connecting Thirdrema toward Fourfolkshire.
67. **Problem:** No Full Moon / New Moon time trigger for secret portals.  
   **Supposed to be:** Moon-phase / night condition unlocking Hidden Garden & Tomb of Inversion.
68. **Problem:** `HiddenGarden` is only 8 parts (`desc = 8`).  
   **Supposed to be:** Lush overgrown sanctuary with ruins, glowing flora, and secret shrine.
69. **Problem:** Missing **Tomb of Inversion (`反転の墓標`)** location and folder.  
   **Supposed to be:** Dedicated hidden field unlocked from Prismatic Forest Grotto.
70. **Problem:** Grotto entrance uses `10×28×10` `Slate` blocks + `Neon` rectangle.  
   **Supposed to be:** Natural mossy cavern mouth carved into the hillside.
71. **Problem:** No spiderweb curtains or giant hive structures inside the grotto.  
   **Supposed to be:** Web-draped boss arena and hanging honeycombs.
72. **Problem:** No subterranean glowing water pools or streams.  
   **Supposed to be:** Reflective underground pools mirroring the glowing ceiling moss.
73. **Problem:** No harvestable prismatic herbs, nectar, or spider silk nodes.  
   **Supposed to be:** Interactive gathering nodes for rare alchemical materials.
74. **Problem:** Entering the grotto does not shift lighting/atmosphere to bioluminescent twilight.  
   **Supposed to be:** Zone-based Lighting/Atmosphere transition inside the cavern.
75. **Problem:** No Pioneer camp or route markers between Thirdrema and the Grotto.  
   **Supposed to be:** Trail lanterns and warning signs leading to the cave entrance.
76. **Problem:** `Eighthold` (`エイドルド`) has only 4 crystal parts total.  
   **Supposed to be:** Entire city architecture incorporating crystal spires, trim, and masonry.
77. **Problem:** 1 crystal part in Eighthold floats high above terrain (`highAboveTerrain = 1`).  
   **Supposed to be:** All crystal ornaments anchored cleanly to roofs or pedestals.
78. **Problem:** `Eighthold_Townhouse_*` roofs lack the ornate rooftop crystal clusters shown in reference.  
   **Supposed to be:** Multi-shard glowing blue crystal finials crowning major rooftops.
79. **Problem:** `Eighthold_TwinArchBridge` lacks crystal post finials and blue-stone masonry trim.  
   **Supposed to be:** Ornate stone twin-arch bridge with glowing crystal bollards.
80. **Problem:** Eighthold streetlamps use generic medieval iron posts instead of crystal bollards.  
   **Supposed to be:** Crystal-topped canal bollards and lampposts.
81. **Problem:** No Crystal Armory / Weapon & Armor Vendor (`水晶系の武器や防具`) in Eighthold.  
   **Supposed to be:** Specialty Crystal Smithy NPC selling crystal blades and shields.
82. **Problem:** Eighthold has zero town `SLFNPCs`.  
   **Supposed to be:** Merchants, guards, and Pioneer NPCs populating the canal quays.
83. **Problem:** `EightholdCanalWater` is flat bright cyan instead of translucent reflective water with depth.  
   **Supposed to be:** Clear blue-teal canal water with visible stone riverbed and steps.
84. **Problem:** Missing wrought-iron canal railings and stone staircases down to the water.  
   **Supposed to be:** Continuous canal balustrades and quay stairs flanking the bridge.
85. **Problem:** No fortified crystal-trimmed city gatehouse for Eighthold.  
   **Supposed to be:** Grand border gatehouse suited to Eighthold's dangerous location.
86. **Problem:** Respawn crystals in Cities 4–14 are bare glowing blocks.  
   **Supposed to be:** Carved stone shrines holding faceted translucent respawn crystals.
87. **Problem:** No Eighthold NPC dialogue about Crystal Scorpions, high crime, or danger.  
   **Supposed to be:** Canon NPC dialogue referencing Crystal Nest Cliff and local hazards.
88. **Problem:** Bare terrain slopes clip behind the left Eighthold townhouse.  
   **Supposed to be:** Clean stone quay retaining walls framing the entire canal district.
89. **Problem:** No crystal-market stalls displaying ores, tonics, and crystal weapons.  
   **Supposed to be:** Themed Eighthold market stalls along the plaza.
90. **Problem:** No visible road/pass linking Eighthold (`-220, -920`) to Crystal Nest Cliff (`245, -880`).  
   **Supposed to be:** Steep mountain switchback road connecting Eighthold to the cliff pass.
91. **Problem:** Enemies named `Lv. 99 Blue Crystal Scorpion` and `Lv. 99 SUPER RARE Gold Crystal Scorpion`.  
   **Supposed to be:** Canon names: `Crystal Scorpion (水晶群蠍)`, `Elder Crystal Scorpion`, `Goldie Scorpion`.
92. **Problem:** All 4 Crystal Scorpions stand static with no pack/burrow AI.  
   **Supposed to be:** Ambush burrowing, tail-laser telegraphs, and territorial aggro.
93. **Problem:** No crystal-beam refraction or light-burst attack patterns.  
   **Supposed to be:** Prismatic beam attacks and shell-reflection shield phases.
94. **Problem:** No blunt/impact vs slash damage multiplier against crystal carapaces.  
   **Supposed to be:** Armor-type weakness favoring blunt/heavy impact and high-TEC hits.
95. **Problem:** No Crystal Equipment items (`Crystal Blade`, `Crystal Buckler`) in `SLFConfig`.  
   **Supposed to be:** Craftable/purchasable crystal gear tier with reflection/durability traits.
96. **Problem:** `Tomb of Inversion (反転の墓標)` missing from `SLFConfig.Locations`.  
   **Supposed to be:** Registered as a secret location with coordinates and banner title.
97. **Problem:** `Prismatic Forest Grotto` coordinates `(640, 35, -420)` sit on surface grass.  
   **Supposed to be:** Underground cavern Y-level (`Y < 10`) beneath the ridge.
98. **Problem:** No shard-bleed / crystal-dust environmental hazard in Crystal Nest Cliff.  
   **Supposed to be:** Environmental hazard warning and chip damage in deep Crystal Hell.
99. **Problem:** No moon-phase / rare spawn timer for `Goldie Scorpion` and `Empire Bee Princess`.  
   **Supposed to be:** Server-tracked rare spawn cycle.
100. **Problem:** Crystal Nest Cliff, Canyon of Ancient Souls, and Prismatic Forest Grotto lack distinct biome identity.  
   **Supposed to be:** Three sharply differentiated vertical/underground/cliffside biomes.

## 2. The Seven Colossi (七つの最強種) & Unique Scenarios

101. **Problem:** Only 3 of the 7 Colossi exist in `SLFEnemies` (`Lycagon`, `Wezaemon`, `Ctarnidd`).  
   **Supposed to be:** All 7 Colossi represented as world encounters or scenario bosses.
102. **Problem:** **Siegwurm the Sky Ruler (`天覇のジークヴルム`)** has no boss model or Dragon's Nest arena.  
   **Supposed to be:** Colossal winged dragon boss on a high mountain peak/sky arena.
103. **Problem:** **Vysache the Immortal (`不滅のヴァイスアッシュ`)** has no boss/sparring encounter in Rabituza.  
   **Supposed to be:** High-level Vorpal sparring/trial boss in Vysache's colosseum.
104. **Problem:** **Orchestra (`無尽のオーケストラ`)** has no arena, musical mechanics, or encounter.  
   **Supposed to be:** Sound/rhythm-based Unique Monster arena.
105. **Problem:** **Goldunine the Inexhaustible (`無尽のゴルドゥニーネ`)** has no serpent-clone boss encounter.  
   **Supposed to be:** Multi-phase serpent queen encounter with poison/clone mechanics.
106. **Problem:** `Wezaemon the Tombguard` stands alone without his **Graveyard (`墓標`)** arena or **Kirin (`麒麟`)** phase.  
   **Supposed to be:** Full 3-phase Wezaemon encounter with Clear Sky (`晴天流`) & Kirin mount.
107. **Problem:** `Wezaemon` lacks **Setsuna's Grave** cutscene/dialogue trigger when approached.  
   **Supposed to be:** Interactive scenario trigger at Setsuna's Tomb in Thirdrema/graveyard.
108. **Problem:** `Wezaemon` lacks `Heavenly Clear` / `Tachikaze` / `Sky Clear` named telegraphed AoE skills.  
   **Supposed to be:** Canon telegraphed sword arts with parry/dodge windows.
109. **Problem:** `Lycagon the Nightslayer` spawns statically without **Nighttime-only / Shadow Clone (`影狼`)** mechanics.  
   **Supposed to be:** Night-spawned Shadow Lycagon encounter with **Curse Mark (`呪い`)** reward.
110. **Problem:** Defeating/surviving `Lycagon` does not apply the **Lycagon's Mark (`リュカオーンの呪い`)**.  
   **Supposed to be:** Visible curse mark preventing torso/leg armor while boosting Vorpal Spirit.
111. **Problem:** `Ctarnidd of the Abyss` has no **4-Chalice Inversion (`反転`)** puzzle mechanics in combat.  
   **Supposed to be:** Destroying/activating the 4 Chalices flips gravity, stats, healing, or gender.
112. **Problem:** `Ctarnidd` arena has no multi-stage tentacle/ink/abyssal phase transitions.  
   **Supposed to be:** Phase 1–3 tentacle, abyssal surge, and true-body core phases.
113. **Problem:** No **Unique Scenario EX** tracking UI or progress state.  
   **Supposed to be:** Dedicated Unique Scenario tracker in `SLFClient`.
114. **Problem:** No **Colossus Server-Wide Announcement (`世界公告`)** banner when a Colossus is engaged or defeated.  
   **Supposed to be:** Server-wide golden announcement banner to all Pioneers.
115. **Problem:** No **Unique Weapon / Inventoria (`インベントリア`)** rewards tied to Colossi.  
   **Supposed to be:** Unlockable Inventoria key and Unique-grade gear drops.
116. **Problem:** `Vorpal Bunny Duelist` in `SLFEnemies` is the only Rabituza combatant outside the gauntlet.  
   **Supposed to be:** Named Vorpal Bunny masters (`Emul`, `Bilac`, `Elma`, `Ceecrue`).
117. **Problem:** **Emul (`エムル`)** companion NPC/follower system is missing.  
   **Supposed to be:** Follows players who unlock *Invitation from Rabituza* with magic support.
118. **Problem:** **Bilac (`ビィラック`)** Ancient Craftsman NPC is missing from Rabituza.  
   **Supposed to be:** Weapon-forging/reinforcement NPC in Rabituza's forge.
119. **Problem:** No **Vorpal Epic (`ヴォーパル魂` / `兎の国からの叙事詩`)** follow-up scenario after *Invitation from Rabituza*.  
   **Supposed to be:** Multi-stage Rabituza progression chain.
120. **Problem:** No **Rabituza Defensive (`ラビッツ防衛戦`)** wave defense event.  
   **Supposed to be:** Timed invasion defense event in Rabituza.
121. **Problem:** `InvitationGauntlet` rounds 1–10 spawn generic enemies without unique arena dialogue or waves.  
   **Supposed to be:** Named round introductions, escalating Vorpal trials, and boss finale.
122. **Problem:** `VorpalSoulCollar` only modifies EXP (`0.5×`) and stat points (`+6`) without visible neck accessory.  
   **Supposed to be:** Equipped collar mesh on the player's character model.
123. **Problem:** No **Unique Monster Lore Codex** in the player menu.  
   **Supposed to be:** Encyclopedia tracking discovered Colossi and clear records.
124. **Problem:** No **First-Clear / World-First** title system.  
   **Supposed to be:** Distinct titles for first-clear vs repeat Colossus clears.
125. **Problem:** Colossus models in `SLFEnemies` are small/basic compared to canon scale.  
   **Supposed to be:** Massive boss-scale articulated models (`40–120` studs) with boss healthbars.
126. **Problem:** No dedicated **Boss Healthbar HUD** when fighting a Colossus.  
   **Supposed to be:** Top-screen cinematic boss HP bar with phase markers and name/title.
127. **Problem:** No **Boss BGM / Combat Music** transition when entering a Colossus radius.  
   **Supposed to be:** Dynamic boss theme audio.
128. **Problem:** No **Party / Raid Lockout** or multi-player scaling on Colossi.  
   **Supposed to be:** HP and reward scaling by party size.
129. **Problem:** No **Death Penalty / Respawn Shrine** warp after wiping to a Colossus.  
   **Supposed to be:** Canon respawn at nearest visited city shrine with durability/EXP check.
130. **Problem:** `Lycagon` lacks **Darkness / Moonlight** visual aura and glowing red eyes.  
   **Supposed to be:** Shadow-smoke particles and crimson eye trails.
131. **Problem:** `Wezaemon` lacks samurai armor silhouette, glowing visor, and floating sheath.  
   **Supposed to be:** Detailed cybernetic undead samurai armor and giant katana.
132. **Problem:** `Ctarnidd` lacks giant octopus/kraken tentacles rising around the Ruluiath plaza.  
   **Supposed to be:** 8 articulated tentacles surrounding the sunken arena.
133. **Problem:** `ChaliceOfInvertedGender` has no player appearance/voice/tag toggle.  
   **Supposed to be:** Fun cosmetic inversion effect during the Ctarnidd encounter.
134. **Problem:** `ChaliceOfInvertedStats` does not actually swap STR/INT or offensive/defensive stats.  
   **Supposed to be:** Temporary stat-swap aura during Ctarnidd phase.
135. **Problem:** `ChaliceOfInvertedHealing` does not invert potions into damage or vice versa.  
   **Supposed to be:** Tactical healing-inversion debuff mechanic.
136. **Problem:** `ChaliceOfInvertedGravity` does not alter `Workspace.Gravity` or jump/camera feel in Ruluiath.  
   **Supposed to be:** Localized gravity inversion wave.
137. **Problem:** No **New Continent (`新大陸`)** ferry/unlock quest after defeating Ctarnidd.  
   **Supposed to be:** Post-Ctarnidd harbor unlock at Fifticia toward Tearplane.
138. **Problem:** No **Golden Scorpion (`ゴールディ・スコーピオン`)** Unique/Extraordinary spawn event.  
   **Supposed to be:** Rare golden boss event in Crystal Nest Cliff.
139. **Problem:** No **Mud Digger** ambush animation (burrows/emerges).  
   **Supposed to be:** Subterranean ambush burst in Diremarsh Waste.
140. **Problem:** No **Vorpal Weapon** passive bonus (`Vorpal Soul` scaling on critical hits).  
   **Supposed to be:** Weapons tagged `Vorpal` gain crit/damage scaling with `VorpalSoul`.
141. **Problem:** No **Weapon Durability / Sharpening (`研磨`)** system.  
   **Supposed to be:** Durability gauge and whetstone/blacksmith repair.
142. **Problem:** No **Critical Hit Weak-Spot (`弱点部位`)** multiplier on Colossi.  
   **Supposed to be:** Head/core weak-spot hitboxes dealing bonus crit damage.
143. **Problem:** No **Parry / Just-Guard (`パリィ`)** or **Just-Dodge** mechanic.  
   **Supposed to be:** Timed dodge/parry window triggering counter-attack bonus.
144. **Problem:** No **Skill Tree / Magic Scroll** unlocking for Colossi.  
   **Supposed to be:** Boss drops unlocking signature martial/magic skills.
145. **Problem:** No **Arena Boundary / Fog Wall** during Colossus boss fights.  
   **Supposed to be:** Translucent arena barrier keeping boss fights contained.
146. **Problem:** Colossi do not drop **Trophy / Relic** items for Inventoria display.  
   **Supposed to be:** Collectible boss trophies.
147. **Problem:** No **Graveyard of Past Glories** tie-in lore for Wezaemon's era (`神代`).  
   **Supposed to be:** Ancient Era (`神代`) terminal logs and ruins.
148. **Problem:** No **Inventoria SubSpace** interactive storage chest or armor rack.  
   **Supposed to be:** Functional gear storage and teleport entrance inside Inventoria.
149. **Problem:** `InventoriaSubSpace` at `(3600, -80, 3800)` has only 65 basic parts.  
   **Supposed to be:** Ornate pocket-dimension library/armory interior.
150. **Problem:** No **Vorpal Soul Threshold Gate** checking `VorpalSoul >= 100` before Rabituza entry.  
   **Supposed to be:** Canon gatekeeper check at the Rabituza secret alley door.
151. **Problem:** No **Karma Bounty / PKer Hunter** system despite `Karma` stat existing.  
   **Supposed to be:** High-Karma players flagged for guards/bounty hunters.
152. **Problem:** No **Trust Discount / Secret Quest** unlock at high `Trust`.  
   **Supposed to be:** Shop discounts and hidden NPC quests at high Trust.
153. **Problem:** No **Mettle (`歴戦`) Aura** intimidating low-level mobs.  
   **Supposed to be:** Low-level monsters flee or hesitate when `Mettle` is high.
154. **Problem:** No **Extraordinary Monsters** tier distinct from regular mobs and Colossi.  
   **Supposed to be:** Named `Extraordinary` tier (`Quad Beetle`, `Golden Age`, etc.).
155. **Problem:** No **World Boss Respawn Timer** HUD or town-crier rumor system.  
   **Supposed to be:** NPCs share rumors when a Colossus or Extraordinary mob is active.
156. **Problem:** No **Stagger / Break Gauge** on Colossus bosses.  
   **Supposed to be:** Posture/stagger bar opening massive punish windows.
157. **Problem:** No **Phase-2 Cutscene / Camera Shake** on Colossus transitions.  
   **Supposed to be:** Client-side camera shake and phase-transition VFX.
158. **Problem:** No **Status Effects (`Poison`, `Curse`, `Burn`, `Bleed`, `Stun`)** on boss attacks.  
   **Supposed to be:** Full status-effect icons and tick logic.
159. **Problem:** No **Ancient Era (`神代`)** lore artifacts in `IronRuinOfTheDivinity` and `WeaponsDevelopmentLab_Bunker`.  
   **Supposed to be:** Discoverable Ancient Era tech logs.
160. **Problem:** No **Siegwurm** sky-shadow flyover event across the continent.  
   **Supposed to be:** Periodic dragon shadow/roar event in high-altitude zones.
161. **Problem:** No **Goldunine** poison swamp lair.  
   **Supposed to be:** Toxic serpent nest biome.
162. **Problem:** No **Orchestra** concert hall ruin.  
   **Supposed to be:** Echoing ruin arena with musical pillar mechanics.
163. **Problem:** No **Vysache** forge cutscene/crafting upgrade for Vorpal weapons.  
   **Supposed to be:** Vysache/Bilac weapon evolution (`Vorpal Chopper` -> upgraded tiers).
164. **Problem:** No **Pencilgon / Oikatzo / Sunraku** style Pioneer guild/party system.  
   **Supposed to be:** Party creation, shared XP, and raid invites.
165. **Problem:** No **PK / Duel Arena** toggle in cities/wilds.  
   **Supposed to be:** Consensual Pioneer duel system outside safe zones.
166. **Problem:** No **Safe-Zone Barrier** preventing combat inside cities.  
   **Supposed to be:** Weapon-sheathe / PvE-safe protection inside city walls.
167. **Problem:** No **Fast-Travel / Teleportation** crystal network between visited cities.  
   **Supposed to be:** Respawn shrines double as discovered fast-travel nodes.
168. **Problem:** No **Bounty Board** in Firstia, Secondil, and Thirdrema Guilds.  
   **Supposed to be:** Repeatable monster-hunting bounties.
169. **Problem:** No **Guild Rank (`E` to `S`)** progression.  
   **Supposed to be:** Rank advancement unlocking higher-tier quests.
170. **Problem:** No **Achievement / Title Equip** UI.  
   **Supposed to be:** Selectable earned titles (`Honorary Rabituzan`, `Giantslayer`, etc.).
171. **Problem:** No **Monster Drop Magnetism / Loot Bag** visuals.  
   **Supposed to be:** Glowing dropped loot chests/orbs with pickup prompts.
172. **Problem:** No **Equipment Enhancement (`強化`)** at Blacksmiths.  
   **Supposed to be:** Stat/multiplier upgrades using monster ores.
173. **Problem:** No **Accessory / Necklace / Ring** slots in inventory.  
   **Supposed to be:** Multi-slot equipment loadout.
174. **Problem:** No **Consumable Quickbar (`1–5` keys)** for HP/MP/STM potions.  
   **Supposed to be:** Hotbar slots for instant potion use in combat.
175. **Problem:** No **Stamina (`STM`) Exhaustion** penalty when sprinting/dodging at 0 STM.  
   **Supposed to be:** Brief exhaustion slowdown when STM hits zero.
176. **Problem:** No **Magic Casting (`MP`)** spellbook for Magician/Sage/Sorcerer jobs.  
   **Supposed to be:** Distinct elemental/healing spells per magic job.
177. **Problem:** No **Dual-Wielding (`二刀流`)** animation/combo support for Twin Blade User.  
   **Supposed to be:** Faster dual-hit combo string.
178. **Problem:** No **Stealth / Backstab** bonus for Thief/Ninja jobs.  
   **Supposed to be:** Positional backstab multiplier.
179. **Problem:** No **Longsword / Greatsword** heavy cleave arc for Knight/Fighter.  
   **Supposed to be:** Wide-arc heavy weapon swing.
180. **Problem:** No **Bow / Magic Arrow** projectile combat for Magic Archer.  
   **Supposed to be:** Ranged arrow/mana-bolt projectile targeting.
181. **Problem:** No **Blacksmith / Ancient Craftsman** field-crafting skill.  
   **Supposed to be:** Portable forge/repair skill for crafting jobs.
182. **Problem:** No **Job Promotion Quest** at Level 25/50 (`Swordsman -> Sword Master -> Master Swordsman`).  
   **Supposed to be:** Structured promotion trials.
183. **Problem:** No **Hidden Job Unlock Triggers** (`Ninja`, `Revenger`, `Ancient Craftsman`).  
   **Supposed to be:** Secret unlock conditions tracked on server.
184. **Problem:** No **Origin Spawn Cutscene / Tutorial** for `Wanderer` vs `Firstia` origins.  
   **Supposed to be:** Brief intro lore card on first spawn.
185. **Problem:** No **Boss Retry / Instance Reset** for *Invitation from Rabituza*.  
   **Supposed to be:** Clean instance reset without server restart.
186. **Problem:** No **Arena Spectator / Leaderboard** for fastest Colossus clears.  
   **Supposed to be:** Server/session clear-time board.
187. **Problem:** No **Curse-Removal / Sacred Spring** quest for Lycagon's Mark.  
   **Supposed to be:** Optional endgame questline.
188. **Problem:** No **Elemental Resistances** (`Fire`, `Water`, `Lightning`, `Dark`, `Crystal`) on armor and bosses.  
   **Supposed to be:** Elemental affinity table in `SLFConfig`.
189. **Problem:** No **Day/Night Cycle** driving nocturnal spawns (`Lycagon`, moon-phase Grotto).  
   **Supposed to be:** Continuous 24-hour game clock with moon phases.
190. **Problem:** No **Weather System** (rain in Diremarsh, fog in Tearlight Lake, snow in Alpine).  
   **Supposed to be:** Biome-aware weather particles.
191. **Problem:** No **Colossus Weak-Point Telegraph** VFX (glowing cracks/runes).  
   **Supposed to be:** Clear visual telegraphs before lethal attacks.
192. **Problem:** No **Knockback / Hitstop / Camera Shake** on heavy hits.  
   **Supposed to be:** Responsive combat game-feel feedback.
193. **Problem:** No **Skill Cooldown HUD** on screen.  
   **Supposed to be:** Bottom-center skill bar showing cooldowns and MP/STM costs.
194. **Problem:** No **Target Lock-On (`Tab` / `Middle-Click`)** for 3D boss fights.  
   **Supposed to be:** Camera lock-on to active boss.
195. **Problem:** No **Revive / Downed State** for party members in Colossus raids.  
   **Supposed to be:** Short revive window before shrine respawn.
196. **Problem:** No **Vorpal Soul Loss** warning when grinding repetitive weak mobs.  
   **Supposed to be:** Subtle feedback when Vorpal Soul rises or decays.
197. **Problem:** No **Trust / Karma HUD tooltips** explaining how actions affect hidden stats.  
   **Supposed to be:** Clear lore tooltips in Status UI.
198. **Problem:** No **Colossus Trophy Hall** in Thirdrema Grand Palace.  
   **Supposed to be:** Hall displaying defeated Colossus statues.
199. **Problem:** No **Endgame New Continent (`新大陸`)** preview portal/dock.  
   **Supposed to be:** Locked endgame ship at Fifticia ready for expansion.
200. **Problem:** No **Comprehensive Playtest Suite** covering all 7 Colossi & 10-round gauntlet.  
   **Supposed to be:** Automated integration test script.

## 3. Cities 1–5 (Firstia, Secondil, Thirdrema, Fourfolkshire, Fivelle)

201. **Problem:** `Firstia` (`ファスティア`) retains `66` leftover `AlleyLine_*`, `StreetlampPost_*`, and `DefensivePerimeter` primitive blocks alongside new buildings.  
   **Supposed to be:** Cohesive starter town with clean cobblestone avenues and unified props.
202. **Problem:** `FirstiaPlazaFountain` uses stacked basic cylinders instead of detailed stone masonry.  
   **Supposed to be:** Ornate multi-tier carved stone plaza fountain with water particles.
203. **Problem:** `RabbitMoonInn_Walkable` has sparse/empty interior rooms.  
   **Supposed to be:** Furnished tavern counter, beds, tables, lanterns, and Innkeeper Marla behind the desk.
204. **Problem:** `FirstiaAdventurersGuild_Walkable` lacks quest board props, banners, and guild desks.  
   **Supposed to be:** Detailed guild hall with bounty board, reception counter, and map table.
205. **Problem:** `FirstiaBlacksmithForge` lacks anvil, bellows, weapon racks, and Forge Master Garrick beside the hearth.  
   **Supposed to be:** Working forge interior with glowing hearth and weapon displays.
206. **Problem:** `Firstia` town NPCs stand outdoors in open plaza instead of inside/in front of their landmark shops.  
   **Supposed to be:** NPCs stationed at their actual counters/forges.
207. **Problem:** `Firstia` perimeter wall has repetitive flat grey blocks with no battlements or watchtowers.  
   **Supposed to be:** Stone town walls with corner watchtowers and timber-framed gatehouse.
208. **Problem:** No starter training dummies (`TrainingDummy`) outside Firstia Guild for testing weapon multipliers.  
   **Supposed to be:** Interactive DPS test dummies showing damage numbers.
209. **Problem:** No starter signpost pointing west toward The Rampant Forest (`1540, 130`).  
   **Supposed to be:** Clear wooden signpost at the west gate.
210. **Problem:** `FirstiaFarmlandsAndOrchards` outside the east/south walls uses basic blocks.  
   **Supposed to be:** Fenced wheat fields, wooden windmill, and orchard trees.
211. **Problem:** No starter potion/weapon shop UI triggered by Firstia merchants.  
   **Supposed to be:** Working shop UI when interacting with Blacksmith/Merchant NPCs.
212. **Problem:** No town ambient chatter or background acoustic guitar/flute loop.  
   **Supposed to be:** Warm peaceful starter-town ambience.
213. **Problem:** `Firstia` spawn point can place players facing away from the plaza fountain.  
   **Supposed to be:** Spawn facing the central fountain and Guild Hall.
214. **Problem:** No beginner tutorial quest (`Defeat 3 Forest Wolves in Rampant Forest`) from Elena.  
   **Supposed to be:** Guided starter quest introducing combat & Vorpal Soul.
215. **Problem:** `FirstiaMarketStall_1..12` coexist with new `Firstia_Stall_1..4`, creating two mismatched stall styles.  
   **Supposed to be:** Unified detailed `Tpl_MarketStall` marketplace.
216. **Problem:** `Firstia` streetlamps (`StreetlampPost_1..14`) are thin grey sticks with neon cubes.  
   **Supposed to be:** Replaced with detailed `Tpl_StreetLight` lanterns.
217. **Problem:** No stone bridge over the stream bordering Firstia.  
   **Supposed to be:** Stone arch bridge leading toward The Rampant Forest.
218. **Problem:** No town guards patrolling Firstia's gates.  
   **Supposed to be:** Animated/patrolling gate guards.
219. **Problem:** No visible bulletin board showing Pioneer rankings or rumors.  
   **Supposed to be:** Interactive town notice board.
220. **Problem:** Firstia terrain edge near the east coast drops abruptly without beach/cliff transition.  
   **Supposed to be:** Smooth sandy shoreline and coastal rocks.
221. **Problem:** `Secondil` (`セカンディル`) `DefensivePerimeter` still uses plain grey wall segments.  
   **Supposed to be:** Fortified ochre-brick battlements matching `SecondilTwinGatehouse`.
222. **Problem:** `SecondilCentralCastleKeep` is still a primitive multi-box keep behind the new `Tpl_MedievalHouse` buildings.  
   **Supposed to be:** Upgraded detailed stone keep/garrison.
223. **Problem:** `Secondil` (`1250, 50, 140`) has only 6 buildings inside a `220`-radius walled perimeter, leaving huge empty stone courtyards.  
   **Supposed to be:** Balanced street blocks with inn, stables, barracks, and market square.
224. **Problem:** No road continuity between The Rampant Forest exit and `SecondilTwinGatehouse`.  
   **Supposed to be:** Paved cobblestone highway entering directly through the gate arch.
225. **Problem:** No caravan/wagon props in Secondil (canonically a fortified trade-route gate town).  
   **Supposed to be:** Merchant wagons, crates, and horse stables.
226. **Problem:** `Secondil_GateCaptain` stands far from the actual gatehouse arch.  
   **Supposed to be:** Stationed right at the gatehouse entrance.
227. **Problem:** No transition markers toward Diremarsh Waste (`980, 60`).  
   **Supposed to be:** West-gate warning signs for swamp ambushes.
228. **Problem:** No Secondil blacksmith forge building or shop UI.  
   **Supposed to be:** Dedicated smithy exterior/interior for Armorer Torin.
229. **Problem:** No Secondil inn/rest point.  
   **Supposed to be:** Restable inn recovering HP/MP/STM.
230. **Problem:** No Secondil garrison tower stairs to walk the ramparts.  
   **Supposed to be:** Walkable wall battlements and gatehouse overlook.
231. **Problem:** No lanterns illuminating Secondil's west exit toward Diremarsh.  
   **Supposed to be:** Warm torch/lantern line along the road.
232. **Problem:** `Secondil` floor is uniform grey `Cobblestone` without sidewalks, curbs, or planters.  
   **Supposed to be:** Curbed streets, flower boxes, and plaza paving patterns.
233. **Problem:** No directional banners (`Secondil` crest) on the gatehouse.  
   **Supposed to be:** Custom town banners flanking the arch.
234. **Problem:** No trade-caravan escort or Diremarsh clearing quest from Captain Cedric.  
   **Supposed to be:** Local questline bridging Cities 2 and 3.
235. **Problem:** Terrain height variations at `Secondil` (`Y = 50`) cause slight foundation gaps on perimeter walls.  
   **Supposed to be:** Terrain-snapped wall foundations.
236. **Problem:** `Thirdrema` (`サードレマ`) is canonically a **3-tier castle city** (Castle Keep / Upper / Lower), but only has one flat plaza + palace stairs.  
   **Supposed to be:** Distinct Lower District, Upper Merchant Tier, and Grand Duke's Castle Tier.
237. **Problem:** `RoyalGrandPalaceOfThirdia_Walkable` (`steps/2451/media_0.jpg`) still uses basic cylinder towers with cone roofs next to detailed `Tpl_MedievalHouse` buildings.  
   **Supposed to be:** High-detail palace facade matching the surrounding medieval/baroque standard.
238. **Problem:** `CathedralOfTheSevenColossi_Walkable` in Thirdrema lacks stained glass, nave pews, and Seven Colossi statues.  
   **Supposed to be:** Grand cathedral interior with 7 Colossus stone statues.
239. **Problem:** `ThirdremaGothicClocktower` (`steps/2451/media_0.jpg`) is a tall speckled cylinder/box with a flat white circle clock face.  
   **Supposed to be:** Detailed clocktower with carved stone trim, clock hands, and belfry.
240. **Problem:** `GothicSkybridge_1..3` use basic wedge/block arches.  
   **Supposed to be:** Ornate stone/iron skybridges connecting Upper Tier buildings.
241. **Problem:** `Thirdrema` (`720, 82, 40`) has `radius = 380` with only 8 buildings, leaving wide empty stone slabs.  
   **Supposed to be:** Dense multi-tier urban blocks, plazas, and back-alleys.
242. **Problem:** `AlleyMazeWall1/2` and `RabituzaSecretBackAlleyDoor` look like plain grey boxes tucked behind the plaza.  
   **Supposed to be:** Atmospheric narrow cobblestone back-alley leading to the glowing Vorpal rune door.
243. **Problem:** `SetsunasGravestone` sits on a bare `SetsunasTombPlatform` block without cherry trees, lanterns, or memorial shrine.  
   **Supposed to be:** Peaceful memorial grove with stone lanterns and cherry blossoms.
244. **Problem:** `ThirdremaValleyForest` overlaps/clashes with the outer city wall.  
   **Supposed to be:** Cleanly landscaped outer parklands.
245. **Problem:** `ThirdremaTriumphalGatehouse` (`Mesh_ThirdremaGate`) faces `Z+` slightly offset from the main avenue centerline.  
   **Supposed to be:** Aligned flush with the grand avenue and city wall.
246. **Problem:** No Thirdrema Upper/Lower tier staircases or ramps on the sides.  
   **Supposed to be:** Multiple interconnected stairways between city tiers.
247. **Problem:** No Thirdrema Grand Library / Lore Archive interior for `Thirdrema_Archivist`.  
   **Supposed to be:** Walkable archive hall with bookshelves and world maps.
248. **Problem:** No Thirdrema Apothecary shop interior for `Thirdrema_Alchemist`.  
   **Supposed to be:** Potion shop with alchemy shelves and elixir bottles.
249. **Problem:** No branching exit gates from Thirdrema toward Prismatic Forest Grotto, Iron Ruin, and Fourfolkshire.  
   **Supposed to be:** Four distinct labeled compass gates.
250. **Problem:** `AvenueLampPost_*` old neon-block lamps coexist with newer streetlamps.  
   **Supposed to be:** Replaced uniformly with ornate avenue lanterns.
251. **Problem:** No Thirdrema fountain or royal courtyard garden.  
   **Supposed to be:** Landscaped palace forecourt gardens.
252. **Problem:** No Grand Duke / Town NPCs inside the Royal Palace.  
   **Supposed to be:** Royal guards and court NPCs.
253. **Problem:** No player housing or clan-hall teaser building in Thirdrema.  
   **Supposed to be:** Guild/Clan HQ building on the Upper Tier.
254. **Problem:** No Thirdrema arena/dueling courtyard.  
   **Supposed to be:** Training yard for Pioneer sparring.
255. **Problem:** No ambient bell chime from the Gothic Clocktower.  
   **Supposed to be:** Hourly/periodic clocktower bell chime.
256. **Problem:** `Fourfolkshire` (`フォスフォシエ`) (`520, 104, -780`) has only `4` houses and `1` `Tpl_WizardTower` inside a `185`-radius wall.  
   **Supposed to be:** Whimsical fairytale town with `10–12` varied cottages, towers, and gardens.
257. **Problem:** `Fourfolkshire` lost its fairytale gazebo, manicured hedge gardens, and arched bridges in the overhaul.  
   **Supposed to be:** Restored manicured lawns, floral gazebos, and fairytale archways.
258. **Problem:** No NPCs at all in `Fourfolkshire`.  
   **Supposed to be:** Town merchants, herbalists, and Canyon guides.
259. **Problem:** `Fourfolkshire_RespawnShrineBase` and `Crystal` are still primitive blocks.  
   **Supposed to be:** Ornate fairytale stone shrine with faceted crystal.
260. **Problem:** No road connecting Prismatic Forest Grotto (`640, -420`) to Fourfolkshire (`520, -780`).  
   **Supposed to be:** Cobblestone forest trail with lanterns.
261. **Problem:** No road connecting Fourfolkshire west into Canyon of the Ancient Souls (`150, -880`).  
   **Supposed to be:** Mountain pass road heading west.
262. **Problem:** Mountain terrain on the north edge of Fourfolkshire clips near the perimeter wall.  
   **Supposed to be:** Smoothed terrain plateau matching wall elevation.
263. **Problem:** No fairytale banners, flower carts, or fountains in Fourfolkshire's central square.  
   **Supposed to be:** Floral fountain and colorful market carts.
264. **Problem:** No Fourfolkshire questline introducing Canyon of the Ancient Souls / Crystal Nest Cliff.  
   **Supposed to be:** Local Pioneer guide quest.
265. **Problem:** No warm golden fairytale lighting accent in Fourfolkshire.  
   **Supposed to be:** Soft warm sunlight and garden lanterns.
266. **Problem:** `Fivelle` (`180, 58, -80`) has only 4 houses in a `175`-radius wall (`totalParts = 1711`), feeling nearly empty.  
   **Supposed to be:** Full regional town layout with central plaza, inn, and shops.
267. **Problem:** `Fivelle` has zero NPCs, zero quests, and zero market stalls.  
   **Supposed to be:** Town NPCs, vendor stall, and regional quest.
268. **Problem:** `Fivelle` lacks a unique regional architectural theme or landmark.  
   **Supposed to be:** Distinct highland-crossroads clock/bell landmark and stone plaza.
269. **Problem:** `Fivelle` perimeter wall uses the exact same grey wall ring as Cities 6–14.  
   **Supposed to be:** Unique regional stonework and gate design.
270. **Problem:** `Fivelle` has only 1 `Tpl_StreetLight` at `(180, -80)`.  
   **Supposed to be:** Full street lighting across avenues and plaza.
271. **Problem:** No connecting road from Fivelle to Thirdrema (`720, 40`) or Deathcrater Lake (`-60, -280`).  
   **Supposed to be:** Clear crossroads highways.
272. **Problem:** `Fivelle` respawn crystal is a bare neon block.  
   **Supposed to be:** Carved shrine pedestal.
273. **Problem:** No central fountain, well, or monument in Fivelle.  
   **Supposed to be:** Regional stone well/statue centerpiece.
274. **Problem:** No trees, planters, or greenery inside Fivelle's walls.  
   **Supposed to be:** Landscaped courtyard trees and flowerbeds.
275. **Problem:** No interior buildings or enterable inn/guild in Fivelle.  
   **Supposed to be:** At least 1–2 enterable landmark buildings.
276. **Problem:** No signpost showing distances to Thirdrema, Deathcrater Lake, and Sixenveldt.  
   **Supposed to be:** Crossroads signpost.
277. **Problem:** No night-time window glow or warm street ambience in Fivelle.  
   **Supposed to be:** Warm interior window light and lanterns.
278. **Problem:** Fivelle's 4 houses sit symmetrically at `(+/-55, +/-45)` like a copy-pasted square.  
   **Supposed to be:** Organic town street grid with varied building angles and spacing.
279. **Problem:** No regional monster warning near Fivelle's north gate toward Deathcrater Lake.  
   **Supposed to be:** Warning notice for lake hazards.
280. **Problem:** No Fivelle town banner or unique `SLFConfig` lore flavor in-world.  
   **Supposed to be:** Town crest banners at gates.
281. **Problem:** Firstia-to-Thirdrema highway lacks mileage markers or rest camps.  
   **Supposed to be:** Roadside milestones and campfires.
282. **Problem:** Cities 1–5 share identical `DefensivePerimeter` circular wall geometry.  
   **Supposed to be:** Distinct wall shapes (octagonal, terraced, fortified, open-port) per city.
283. **Problem:** Circular city walls cut awkwardly through sloped hillside terrain.  
   **Supposed to be:** Stepped retaining foundations.
284. **Problem:** No city gate guards or interactive gatekeepers at Cities 2–5.  
   **Supposed to be:** Gate NPCs announcing city names and danger levels.
285. **Problem:** No benches, barrels, crates, or street clutter props in Cities 2–5.  
   **Supposed to be:** Lived-in street props (benches, carts, barrels, notice boards).
286. **Problem:** No shop signs hanging outside blacksmiths, inns, and apothecaries.  
   **Supposed to be:** Hanging wooden/iron shop signs.
287. **Problem:** No indoor/outdoor collision check preventing NPCs from spawning inside props.  
   **Supposed to be:** Navmesh/clearance verified around every NPC.
288. **Problem:** No fast-travel shrine interaction (`ProximityPrompt`) on city respawn crystals.  
   **Supposed to be:** Interactive shrine unlocking fast-travel.
289. **Problem:** No city-specific ambient soundscapes (harbor gulls, market murmur, forge hammer).  
   **Supposed to be:** Zone-based ambient audio.
290. **Problem:** No minimap/compass markers for city guilds, inns, and blacksmiths.  
   **Supposed to be:** Clear HUD icons for city services.
291. **Problem:** No night-sky lantern lighting switch when `ClockTime` enters night.  
   **Supposed to be:** Lanterns and windows brighten at dusk.
292. **Problem:** No player-usable chairs/benches in inns or plazas.  
   **Supposed to be:** Working `Seat` instances on benches/chairs.
293. **Problem:** No town bulletin boards with readable Pioneer tips.  
   **Supposed to be:** Interactable lore/tip boards.
294. **Problem:** No visual distinction between safe-zone city interiors and wild monster zones.  
   **Supposed to be:** Subtle gate threshold indicator.
295. **Problem:** No city-to-city caravan/traveler flavor NPCs on the main roads.  
   **Supposed to be:** Wandering NPC merchants along highways.
296. **Problem:** Firstia's old `AlleyLine_*` parts (`80` children in `Firstia`) clutter the workspace.  
   **Supposed to be:** Cleanly organized `Buildings`, `Props`, `Lighting`, `Walls` subfolders.
297. **Problem:** Thirdrema's `63` ungrouped children clutter `SLFWorld.Thirdrema`.  
   **Supposed to be:** Structured subfolders matching city tiers.
298. **Problem:** Cities 1–5 lack roofs/chimney smoke particles on active forges and inns.  
   **Supposed to be:** Subtle rising chimney smoke.
299. **Problem:** No destructible crates/barrels or hidden coin caches in city back-alleys.  
   **Supposed to be:** Minor exploration rewards in alleys.
300. **Problem:** No unified city entrance arch banners displaying each city's Japanese & English name.  
   **Supposed to be:** Carved gate plaques (`第一の街 ファスティア`, etc.).

## 4. Cities 6–15 (Sixenveldt, Sevenburg, Eighthold, Nineshill, Tenverdt, Eleventar, Twelmus, Thirteed, Fourtian, Fifticia)

301. **Problem:** `Sixenveldt` (`340, 62, 720`) has only 4 symmetrically placed houses and 1 lamp inside an empty wall ring.  
   **Supposed to be:** Full bustling southern crossroads town with 10+ buildings and plaza.
302. **Problem:** `Sixenveldt` has zero NPCs, quests, or shops.  
   **Supposed to be:** Town merchants, quest giver, and Iron Ruin expedition NPC.
303. **Problem:** No road linking `Sixenveldt` (`340, 720`) north to `Iron Ruin of the Divinity` (`541, 423`).  
   **Supposed to be:** Ruined stone causeway leading directly to Iron Ruin.
304. **Problem:** `Sixenveldt` lacks a unique regional landmark.  
   **Supposed to be:** Distinct southern bastion/monument.
305. **Problem:** `Sevenburg` (`-320, 66, -120`) has only 4 symmetrical houses and 1 lamp.  
   **Supposed to be:** Full mid-continent fortress town.
306. **Problem:** `Sevenburg` has zero NPCs and zero connection to nearby `Tearlight Lake` (`-580, 180`).  
   **Supposed to be:** NPCs hinting at the secret Tearlight Lake.
307. **Problem:** `Sevenburg` lacks fortified seven-tower/bastion theme matching its name.  
   **Supposed to be:** Seven small watch-turrets along its walls/keep.
308. **Problem:** `Nineshill` (`-280, 86, 560`) is billed as `(Southern Hub)` (`radius = 250`) yet only has 6 houses and 1 fountain.  
   **Supposed to be:** Major southern hub with guild hall, market, inn, and 12+ buildings.
309. **Problem:** `Nineshill` has zero NPCs despite being the Southern Hub.  
   **Supposed to be:** Hub Guild Master, Merchants, Blacksmith, and Southern Patrol Captain.
310. **Problem:** `Nineshill` sits against steep grey mountain slopes (`steps/2513/media_0.jpg`) with no cliffside retaining walls.  
   **Supposed to be:** Terraced hillside retaining walls and mountain-gate tunnel.
311. **Problem:** `Nineshill` market stalls (`steps/2513/media_0.jpg`) clip close to the central fountain base.  
   **Supposed to be:** Properly spaced market square around the fountain.
312. **Problem:** `Tenverdt` (`-260, 82, 1060`) has only 4 houses and 1 lamp.  
   **Supposed to be:** Southern border town leading toward Cazzeria Kingdom.
313. **Problem:** `Tenverdt` has zero NPCs and no road to `CazzeriaKingdom` (`620, 1180`).  
   **Supposed to be:** Southern highway and border outpost.
314. **Problem:** `Eleventar` (`-980, 58, -680`) has 8 buildings around the giant sword basin, but `EleventarSwordBasinAndCanal` still contains the old blocky white `GlassArcade` cylinder.  
   **Supposed to be:** Detailed glass-and-iron vaulted arcade matching `media_1794632378542_50271b36.jpg`.
315. **Problem:** `Eleventar` has `Eleventar_RespawnShrineBase` standing right in front of the sword plaza sightline (`steps/2449/media_0.jpg`).  
   **Supposed to be:** Relocated to a side shrine alcove.
316. **Problem:** `Eleventar` has zero NPCs or lore explaining the giant verdigris sword.  
   **Supposed to be:** Historian/Blacksmith NPCs discussing the giant sword monument.
317. **Problem:** `Eleventar` canal water is flat bright cyan rather than reflective translucent water.  
   **Supposed to be:** Realistic water channel feeding the circular sword basin.
318. **Problem:** `Eleventar` perimeter wall sits right against a massive mountain cliff (`media_1794636094056_4fb469cf.jpg`), partially burying the northeast edge.  
   **Supposed to be:** Reshaped mountain cliff giving Eleventar breathing room.
319. **Problem:** No road linking `Eleventar` (`-980, -680`) to `Ruins of Past Glories` (`-600, -800`) and `Barren Darkruin` (`-1350, -460`).  
   **Supposed to be:** Clear western/eastern roads.
320. **Problem:** `Twelmus` (`-860, 52, -110`) has only 4 houses and 1 lamp.  
   **Supposed to be:** Full western town with distinct architecture and NPCs.
321. **Problem:** `Twelmus` has zero NPCs, shops, or quests.  
   **Supposed to be:** Western frontier merchants and quests.
322. **Problem:** `Thirteed` (`-880, 48, 360`) has only 4 houses and 1 lamp.  
   **Supposed to be:** Full western forest-edge town.
323. **Problem:** `Thirteed` has zero NPCs and no path west to `Magnanimous Sanctuary` (`-1350, 520`).  
   **Supposed to be:** Pilgrim road leading to Magnanimous Sanctuary.
324. **Problem:** `Fourtian` (`-960, 46, 820`) has only 4 houses and 1 lamp.  
   **Supposed to be:** Southwestern frontier town.
325. **Problem:** `Fourtian` has zero NPCs or coastal/southern route markers.  
   **Supposed to be:** Frontier outpost NPCs and signposts.
326. **Problem:** Cities 5, 6, 7, 10, 12, 13, 14 all have the exact same `totalParts = 1711` and 4-house square layout.  
   **Supposed to be:** Unique urban footprints, building counts, and regional landmarks for each city.
327. **Problem:** Cities 6, 7, 10, 12, 13, 14 have zero `SLFEnemies` nearby on their connecting roads.  
   **Supposed to be:** Level-appropriate wild mobs along every inter-city road.
328. **Problem:** `Fifticia` (`フィフティシア`) (`-1957, 24, 19`) is canonically a **massive port metropolis with Light & Shadow (Upper Town & Underworld/Outside)**, but only has 6 buildings on land.  
   **Supposed to be:** Dense harbor district, upper merchant quarter, and hidden underworld back-alleys.
329. **Problem:** `Fifticia` has **no Underworld / Shadow Quarter (`裏社会・陰街`)**.  
   **Supposed to be:** Hidden tavern, black-market vendors, and underworld quest NPCs.
330. **Problem:** `Fifticia` piers (`HarborPier_-1..1`) are plain white blocks (`steps/2484/media_0.jpg`).  
   **Supposed to be:** Weathered timber piers with mooring bollards, ropes, and lanterns.
331. **Problem:** `MerchantGalleon_North/South` and `GloriousWreckageOfTheGloryEllis` are simple blocky hull shapes.  
   **Supposed to be:** Detailed rigged wooden galleons with masts, sails, and deck props.
332. **Problem:** `Fifticia` Lighthouse (`LighthouseOctagonBase..DomeR`) is built from stacked basic shapes.  
   **Supposed to be:** Detailed coastal lighthouse with rotating beam light.
333. **Problem:** `HarborCranePost/Boom` and `CargoCrateStack` are simple geometric blocks.  
   **Supposed to be:** Detailed timber dockside cranes and varied cargo barrels/crates.
334. **Problem:** `Fifticia` has `radius = 320` with huge bare green grass patches inside the port area (`steps/2484/media_0.jpg`).  
   **Supposed to be:** Fully paved harbor quays, warehouses, and coastal market.
335. **Problem:** No **New Continent (`ティアプレーテン`)** ship boarding NPC/dock at Fifticia.  
   **Supposed to be:** Port captain NPC with New Continent lore/lock until Ctarnidd clear.
336. **Problem:** No underwater/coastal reef transition at Fifticia's shoreline (`steps/2484/media_0.jpg` shows blocky orange/green shoreline).  
   **Supposed to be:** Smooth sandy beach, seawall, and coastal rocks.
337. **Problem:** `Fifticia` NPCs (`Harbormaster`, `Blacksmith`, `Cleric`) stand out in open grass/paving without shop buildings.  
   **Supposed to be:** Stationed at harbor office, shipwright forge, and seaside cathedral.
338. **Problem:** No seaside cathedral building in Fifticia despite having `Cleric Seraphina`.  
   **Supposed to be:** Dedicated harbor cathedral structure.
339. **Problem:** No tavern/inn in Fifticia's port district for Pioneers preparing to sail.  
   **Supposed to be:** Harbor tavern interior.
340. **Problem:** No seagulls, lapping wave audio, or harbor bells at Fifticia.  
   **Supposed to be:** Coastal soundscape.
341. **Problem:** Cities 6–14 lack distinct color/roof palettes per region (`Mesh_EightholdTownhouse` and `Tpl_MedievalHouse` repeat unchanged).  
   **Supposed to be:** Regional banners, roof trims, and district landmarks.
342. **Problem:** Cities 6–14 lack internal street paving grids—buildings sit on flat grey pads.  
   **Supposed to be:** Cobblestone streets, curbs, and central plazas.
343. **Problem:** No city gates/doors actually open or animate on approach.  
   **Supposed to be:** Open archways or animated gate doors.
344. **Problem:** No guard towers manned by NPCs in Cities 6–14.  
   **Supposed to be:** Stationed town guards.
345. **Problem:** No blacksmiths, inns, or potion vendors in Cities 6–14.  
   **Supposed to be:** At least 1 vendor + 1 innkeeper per city.
346. **Problem:** No fast-travel unlock feedback when entering Cities 6–15 for the first time.  
   **Supposed to be:** Discovery banner + fast-travel unlock.
347. **Problem:** Cities 11–14 sit in a straight vertical line (`X = -860..-980`) with almost identical spacing.  
   **Supposed to be:** More organic road curves and varied elevation.
348. **Problem:** Mountain range splits Cities 6–10 from Cities 11–14 without clearly marked mountain passes.  
   **Supposed to be:** Named mountain tunnels/passes connecting east and west corridors.
349. **Problem:** No streetlamps in Cities 5, 6, 7, 10, 12, 13, 14 beyond 1 single lamp at center.  
   **Supposed to be:** Full plaza and gate illumination.
350. **Problem:** No market stalls in Cities 5–14 (aside from `CityPopUpMarketStands` scattered outside).  
   **Supposed to be:** Integrated market squares inside city walls.
351. **Problem:** `CityPopUpMarketStands` (`470` parts) are placed outside/scattered rather than inside city plazas.  
   **Supposed to be:** Organized inside city marketplaces.
352. **Problem:** No town wells, statues, or fountains in Cities 5, 6, 7, 10, 12, 13, 14.  
   **Supposed to be:** Unique plaza centerpiece in every city.
353. **Problem:** No regional beast/bounty posters in Cities 5–15.  
   **Supposed to be:** Local bounty boards matching nearby biome monsters.
354. **Problem:** No fishing spots or harbor boats usable at Fifticia's piers.  
   **Supposed to be:** Interactive fishing prompts and moored rowboats.
355. **Problem:** `Fifticia` road heading east toward `Fourtian`/`Thirteed` looks like disconnected grey dashes (`steps/2484/media_0.jpg`).  
   **Supposed to be:** Continuous, smooth cobblestone/dirt road.
356. **Problem:** No bridge crossing the river/inlet near Fifticia.  
   **Supposed to be:** Harbor stone bridge.
357. **Problem:** No customs/harbor gatehouse between Fifticia's upper town and docks.  
   **Supposed to be:** Fortified port gatehouse.
358. **Problem:** No warehouse interiors or dockside cargo quests.  
   **Supposed to be:** Supply-run / smugglers quest in Fifticia.
359. **Problem:** No distinct lighting mood for Fifticia's Shadow Quarter.  
   **Supposed to be:** Dimmer lantern-lit alleys contrasting with sunlit harbor.
360. **Problem:** No canon `SLFConfig` shop inventories tailored per city tier (City 1 vs City 8 vs City 15).  
   **Supposed to be:** Tiered gear/potion shops scaling with city number.
361. **Problem:** No NPCs referencing adjacent landmarks (e.g., Eleventar -> Ruins, Fifticia -> Ruluiath).  
   **Supposed to be:** Contextual lore dialogue.
362. **Problem:** No city-level safe-zone healing regeneration bonus when resting at inns.  
   **Supposed to be:** Inn rest restores 100% HP/MP/STM.
363. **Problem:** No player-visible city level recommendation on gate signs.  
   **Supposed to be:** Recommended Pioneer level posted at city gates.
364. **Problem:** No street trees or courtyard gardens in Cities 5–14.  
   **Supposed to be:** Town planters and courtyard trees.
365. **Problem:** No consistent streetlamp `PointLight` shadows/warmth across Cities 5–15.  
   **Supposed to be:** Warm `2700K` lantern glow.
366. **Problem:** `FifticiaAnimeLandmarks` has minimal visual presence compared to Firstia/Thirdrema.  
   **Supposed to be:** Prominent port cathedral, lighthouse, and underworld quarter.
367. **Problem:** No shipwrecks or coastal rocks along the western cliffs south of Fifticia.  
   **Supposed to be:** Jagged coastal sea stacks.
368. **Problem:** No directional compass/road signs outside Cities 5–15.  
   **Supposed to be:** Clear crossroads signposts.
369. **Problem:** No unique architectural silhouette distinguishing Twelmus, Thirteed, and Fourtian.  
   **Supposed to be:** Distinct regional tower/roof silhouettes.
370. **Problem:** No night-time patrol torches on city walls.  
   **Supposed to be:** Wall braziers lit at dusk.
371. **Problem:** No interior collision-free doorways on `Tpl_MedievalHouseA/B/C` (they are exterior display models).  
   **Supposed to be:** Walkable interior shop/inn rooms for key buildings.
372. **Problem:** No respawn crystal shrine models in Cities 6–15 (still bare neon blocks).  
   **Supposed to be:** Carved stone crystal shrines.
373. **Problem:** No harbor mist or ocean spray VFX at Fifticia.  
   **Supposed to be:** Subtle coastal spray particles.
374. **Problem:** No merchant ship schedule or flavor departure horn.  
   **Supposed to be:** Atmospheric harbor horn.
375. **Problem:** No Pioneer guild branch office in Fifticia.  
   **Supposed to be:** Port Guild branch for New Continent expeditions.
376. **Problem:** No road linking `Nineshill` (`-280, 560`) smoothly to `Sixenveldt` (`340, 720`).  
   **Supposed to be:** Paved southern trade road.
377. **Problem:** No road linking `Eleventar` (`-980, -680`) to `Twelmus` (`-860, -110`).  
   **Supposed to be:** Western north-south highway.
378. **Problem:** No road linking `Twelmus` -> `Thirteed` -> `Fourtian`.  
   **Supposed to be:** Continuous western frontier road.
379. **Problem:** No coastal cliff path from `Fourtian` (`-960, 820`) to `Fifticia` (`-1957, 19`).  
   **Supposed to be:** Scenic coastal trade route.
380. **Problem:** No milestone plaques noting how many cities remain to Fifticia.  
   **Supposed to be:** Canon 1st-to-15th city progression markers.
381. **Problem:** `Eighthold` lacks crystal-themed guild/tavern signs.  
   **Supposed to be:** Crystal-inlaid shop signs.
382. **Problem:** `Eleventar`'s giant sword lacks moss/patina stone pedestal plaques.  
   **Supposed to be:** Monument inscription plaque at the basin rim.
383. **Problem:** `Fifticia` ground plateau (`steps/2484/media_0.jpg`) looks like a sharp square terrain block jutting into the ocean.  
   **Supposed to be:** Natural contoured coastline and harbor cove.
384. **Problem:** Square terrain block under Fifticia has harsh 90-degree cliff corners.  
   **Supposed to be:** Smoothly sculpted coastal cliffs and beaches.
385. **Problem:** No harbor seawall masonry around Fifticia's docks.  
   **Supposed to be:** Stone quay walls lining the water.
386. **Problem:** No sunken ship debris near `GloriousWreckageOfTheGloryEllis`.  
   **Supposed to be:** Broken hull planks and reef rocks.
387. **Problem:** No NPCs standing on the Fifticia piers.  
   **Supposed to be:** Sailors and dockworkers.
388. **Problem:** No lantern-lit fish/gear stalls on Fifticia's boardwalk.  
   **Supposed to be:** Waterfront market stalls.
389. **Problem:** No safe-zone map indicator when inside Cities 6–15.  
   **Supposed to be:** HUD badge showing `[SAFE ZONE]`.
390. **Problem:** No distinct music/ambience per major hub (Eighthold, Eleventar, Fifticia).  
   **Supposed to be:** Regional audio tracks.
391. **Problem:** No quest chain connecting Cities 6–15 into the main Old Continent progression.  
   **Supposed to be:** Progressive city-to-city Pioneer storyline.
392. **Problem:** No boss bounty posters for Overdress Golem in Eleventar.  
   **Supposed to be:** Eleventar bounty quest for Ruins of Past Glories.
393. **Problem:** No boss bounty posters for Ctarnidd hints in Fifticia.  
   **Supposed to be:** Harbor rumors about Abyssal City Ruluiath.
394. **Problem:** No alchemy/potion brewing station in Cities 6–15.  
   **Supposed to be:** Interactive apothecary tables.
395. **Problem:** No repair/sharpening anvil in Cities 6–15.  
   **Supposed to be:** Interactive blacksmith anvils.
396. **Problem:** No storage chest access in Cities 6–15.  
   **Supposed to be:** Inventoria/inn storage access points.
397. **Problem:** No decorative flags/pennants fluttering on city towers.  
   **Supposed to be:** Colored regional pennants.
398. **Problem:** No cobblestone road curbing where roads meet city gates.  
   **Supposed to be:** Clean gate apron transitions.
399. **Problem:** No environmental storytelling (campfires, abandoned carts) between Cities 6–15.  
   **Supposed to be:** Roadside Pioneer details.
400. **Problem:** No automated overlap check verifying zero building-to-wall collisions in Cities 6–15.  
   **Supposed to be:** Clean clearance around all perimeters.

## 5. Kingdoms & Hidden Cities (Rabituza, Abyssal City Ruluiath, Cazzeria, Ainverth, Inventoria)

401. **Problem:** `Rabituza` (`ラビッツ`) sits on an exposed surface mountain plateau at `(1050, 144, -1080)` instead of a hidden subterranean/forest-shrouded Vorpal sanctuary.  
   **Supposed to be:** Hidden Vorpal Bunny realm beneath/behind secret barrier.
402. **Problem:** `Rabituza` uses generic `Tpl_MedievalHouseA/B/C` human-scale European houses alongside Japanese `Mesh_VysacheTenshu`.  
   **Supposed to be:** Cohesive Japanese-feudal / Vorpal Bunny architecture sized and styled for Rabituza.
403. **Problem:** `VorpalBunnyCitizen_1..18` are basic primitive spheres/cylinders rather than detailed Vorpal Bunny NPCs.  
   **Supposed to be:** Articulated Vorpal Bunny villagers wearing vests, aprons, and smithy gear.
404. **Problem:** `VorpalBunnyTower_East/Northwest` and `BunnyTopiaryBody` are leftover primitive shapes.  
   **Supposed to be:** Detailed sculpted bunny-ear pagodas and manicured topiaries.
405. **Problem:** `GateBunnyCrestHead/EarL/EarR` and `InnerWallLeft/Right` are plain grey blocks.  
   **Supposed to be:** Ornate torii/feudal gatehouse with carved Vorpal crest.
406. **Problem:** `VorpalColosseum` is a basic ring of blocks rather than a grand Vorpal arena.  
   **Supposed to be:** Detailed tiered wooden/stone colosseum for the 10-round gauntlet.
407. **Problem:** No **Bilac's Workshop (`ビィラックの工房`)** or **Vysache's Throne Room** walkable interiors.  
   **Supposed to be:** Enterable smithy and audience hall.
408. **Problem:** No **Vorpal Weapon Forge** interaction in Rabituza.  
   **Supposed to be:** Unique weapon crafting/enhancement station.
409. **Problem:** No **Emul** guide NPC standing at the Rabituza gate.  
   **Supposed to be:** Interactive Emul NPC.
410. **Problem:** No **Vysache** dialogue NPC in front of/inside the Tenshu.  
   **Supposed to be:** Interactive Vysache NPC giving *Invitation from Rabituza* lore.
411. **Problem:** `RabituzaPavedAvenue` is a flat grey slab.  
   **Supposed to be:** Textured stone-flagged avenue lined with paper lanterns and sakura trees.
412. **Problem:** `BloomingSakuraTree` models around Rabituza are 2-part pink spheres on sticks.  
   **Supposed to be:** Detailed gnarled sakura trees with falling petal particles.
413. **Problem:** `FeudalBambooGrove` models are simple green cylinders.  
   **Supposed to be:** Multi-stalk bamboo groves with leaf clusters.
414. **Problem:** No **Rabituza Secret Back-Alley Teleport** VFX from Thirdrema into Rabituza.  
   **Supposed to be:** Swirling Vorpal rune portal animation.
415. **Problem:** No `VorpalBunny` shop selling Vorpal whetstones, rabbit-style gear, or carrots/elixirs.  
   **Supposed to be:** Working Rabituza merchant.
416. **Problem:** No ambient Japanese koto/flute atmosphere in Rabituza.  
   **Supposed to be:** Distinct serene/mystical Rabituza theme.
417. **Problem:** No **Vorpal Soul Collar** ceremony or NPC explanation.  
   **Supposed to be:** Intro dialogue explaining the collar's 0.5× EXP / +6 stat boost.
418. **Problem:** `Abyssal City Ruluiath` (`深淵都市ルルイアス`) at `(-2150, -75, 3855)` sits on bright white/tan `Sand` in open bright daylight (`steps/2465/media_0.jpg`).  
   **Supposed to be:** Dark, moody, bioluminescent sunken underwater metropolis.
419. **Problem:** No **Underwater / Inverted Ocean Dome (`反転の海`)** effect over Ruluiath.  
   **Supposed to be:** Translucent deep-blue ocean ceiling/caustics overhead without boxy slabs.
420. **Problem:** No **Gravity / Lighting Inversion** atmosphere when entering Ruluiath.  
   **Supposed to be:** Deep abyssal twilight with glowing cyan runes and underwater caustics.
421. **Problem:** `Ruluiath` only has 5 `Mesh_RuluiathSpire` copies + 1 `Tpl_GreekRuins` colonnade.  
   **Supposed to be:** Full sunken city grid of ruined Atlantean streets, arches, and plaza.
422. **Problem:** No **Sunken Coral, Kelp, or Bioluminescent Sea Flora** around Ruluiath.  
   **Supposed to be:** Glowing sea anemones, kelp forests, and coral reefs.
423. **Problem:** No **Bubble / Underwater Current** particle effects in Ruluiath.  
   **Supposed to be:** Rising abyssal bubbles and drifting bioluminescent motes.
424. **Problem:** No **Chalice pedestals** with distinct colored glowing chalices and interactive `ProximityPrompt`s.  
   **Supposed to be:** Four ornate interactive Chalice shrines (`Gender`, `Stats`, `Healing`, `Gravity`).
425. **Problem:** No **Ctarnidd Boss Arena** central sunken amphitheater.  
   **Supposed to be:** Carved circular sunken colosseum for the Ctarnidd fight.
426. **Problem:** No **Inverted Palace / Castle Tower** landmark in Ruluiath.  
   **Supposed to be:** Upside-down / gravity-warped central citadel spire.
427. **Problem:** No **Ruluiath Ghost/Deep-Sea Minion** enemies (`Deep Sea Merfolk`, `Abyssal Squid`).  
   **Supposed to be:** Patrolling abyssal mobs leading to Ctarnidd.
428. **Problem:** No **Portal / Whirlpool Entrance** connecting Severed Sea (`-2350, 200`) to Ruluiath (`-2150, 3855`).  
   **Supposed to be:** Interactive abyssal whirlpool portal.
429. **Problem:** `Ruluiath_SunkenColonnade` (`Tpl_GreekRuins`) has bright terracotta-red roof contrasting with teal Atlantean spires (`steps/2465/media_0.jpg`).  
   **Supposed to be:** Unified weathered sea-stone and teal-coral color palette.
430. **Problem:** No **Underwater Breathing / Abyssal Blessing** status indicator.  
   **Supposed to be:** Clear HUD icon showing underwater exploration buff.
431. **Problem:** `CazzeriaKingdom` (`620, 65, 1180`) is only 4 models (`Tpl_WizardTower`, `Mesh_ThirdremaGate`, 2 medieval houses) with no kingdom walls or city.  
   **Supposed to be:** Full walled royal kingdom with castle courtyard, barracks, and townhouses.
432. **Problem:** `CazzeriaKingdom` has zero NPCs, zero quests, and zero lore.  
   **Supposed to be:** Royal knights, court NPCs, and kingdom lore.
433. **Problem:** `CazzeriaKingdom` lacks a distinct royal architectural identity compared to AinverthKingdom (they use the exact same 4 templates).  
   **Supposed to be:** Distinct Cazzeria heraldry, architecture, and palace keep.
434. **Problem:** `AinverthKingdom` (`エインヴルス王国`, `-640, 60, -1350`) is the **exact same 4 models** as CazzeriaKingdom.  
   **Supposed to be:** Canon capital/royal seat of the Ainverth Kingdom with grand castle and heraldry.
435. **Problem:** `AinverthKingdom` sits on an artificial circular cylinder plateau (`steps/2512/media_0.jpg`) jutting abruptly out of the northern sea.  
   **Supposed to be:** Natural rugged coastal headland integrated with the northern terrain.
436. **Problem:** `AinverthKingdom` has zero NPCs, zero guards, and zero royal quests.  
   **Supposed to be:** King/Regent NPCs, Royal Knights, and endgame lore.
437. **Problem:** No road or bridge connecting `AinverthKingdom` (`-640, -1350`) back to the mainland.  
   **Supposed to be:** Grand northern stone causeway/bridge.
438. **Problem:** No road connecting `CazzeriaKingdom` (`620, 1180`) to `Tenverdt` or `Sixenveldt`.  
   **Supposed to be:** Southern royal highway.
439. **Problem:** `InventoriaSubSpace` (`3600, -80, 3800`) has no walkable portal entrance from player inventory/menu.  
   **Supposed to be:** Working teleport/return button in `SLFClient`.
440. **Problem:** `InventoriaSubSpace` has 65 basic parts with no weapon racks, armor stands, or crystal display cases.  
   **Supposed to be:** Detailed museum/armory interior displaying earned Unique gear.
441. **Problem:** `CharacterCreationStudio` (`3600, -80, 4200`) has only 4 parts.  
   **Supposed to be:** Atmospheric starry/mirror character-creation chamber.
442. **Problem:** No preview avatar rotating in `CharacterCreationStudio` when selecting Job/Origin/Appearance.  
   **Supposed to be:** Live 3D character preview pedestal.
443. **Problem:** No **Rabituza** guard reaction if player enters with low `VorpalSoul`.  
   **Supposed to be:** Gatekeeper check & dialogue.
444. **Problem:** No **Ruluiath** minimap/radar distortion effect (canonically disorienting).  
   **Supposed to be:** Subtle compass/inversion twist in Ruluiath.
445. **Problem:** No **Cazzeria vs Ainverth** faction banners or lore tablets.  
   **Supposed to be:** Historical kingdom lore markers.
446. **Problem:** No **Harbor / Navy Fleet** at AinverthKingdom's northern coast.  
   **Supposed to be:** Royal warships anchored off the coast.
447. **Problem:** No **Cazzeria** arena or knight training grounds.  
   **Supposed to be:** Tournament grounds inside Cazzeria.
448. **Problem:** No **Rabituza** carrot/herb garden behind the townhouses.  
   **Supposed to be:** Vorpal vegetable gardens.
449. **Problem:** No **Ruluiath** sunken streetlamps (bioluminescent crystal posts).  
   **Supposed to be:** Glowing abyssal lampposts lining sunken avenues.
450. **Problem:** No **Inventoria** crafting/alchemy bench inside the subspace.  
   **Supposed to be:** Canon pocket-workshop amenities.
451. **Problem:** No **Rabituza** moonlit waterfall or pond.  
   **Supposed to be:** Tranquil garden pond.
452. **Problem:** No **Cazzeria** royal gatehouse road banners.  
   **Supposed to be:** Approach avenue with kingdom standards.
453. **Problem:** No **Ainverth** cathedral/monument.  
   **Supposed to be:** Royal monument in Ainverth plaza.
454. **Problem:** No **Ctarnidd** intro dialogue/roar when entering Ruluiath.  
   **Supposed to be:** Atmospheric deep-sea rumble.
455. **Problem:** No **Rabituza** colosseum audience of Vorpal Bunnies cheering during the gauntlet.  
   **Supposed to be:** Spectating Vorpal Bunnies around the ring.
456. **Problem:** No **Ruluiath** inverted sky/ocean surface shader or particle layer.  
   **Supposed to be:** Clean overhead ocean shimmer.
457. **Problem:** No **CazzeriaKingdom** terrain blending (currently flat pad).  
   **Supposed to be:** Natural hills and terraced walls.
458. **Problem:** No **Inventoria** trophy pedestals for the 7 Colossi.  
   **Supposed to be:** 7 empty pedestals that light up as Colossi are defeated.
459. **Problem:** No **CharacterCreationStudio** Origin background backdrop changing with selection.  
   **Supposed to be:** Visual backdrop preview per Origin.
460. **Problem:** No **Rabituza** respawn shrine inside the town.  
   **Supposed to be:** Safe-zone return shrine.
461. **Problem:** No **Ruluiath** safe-landing platform upon teleporting in.  
   **Supposed to be:** Clear entry shrine away from Ctarnidd aggro.
462. **Problem:** No **AinverthKingdom** mountain backdrop connection.  
   **Supposed to be:** Bridged to northern cliffs.
463. **Problem:** No **CazzeriaKingdom** southern watchtowers.  
   **Supposed to be:** Coastal lookout towers.
464. **Problem:** No **Unique Scenario** completion badges displayed in Rabituza/Ruluiath.  
   **Supposed to be:** Trophy/title unlock notifications.
465. **Problem:** No **Bilac** dialogue about Ancient Craftsman (`古匠`) heritage.  
   **Supposed to be:** Lore-rich smithy dialogue.
466. **Problem:** No **Emul** magic-buff interaction (`Vorpal Enhancement`).  
   **Supposed to be:** Temporary party buff from Emul.
467. **Problem:** No **Vysache** massive scale contrast (Vysache is huge compared to normal Vorpal Bunnies).  
   **Supposed to be:** Towering boss-scale Vysache model with scar and suit.
468. **Problem:** No **Ruluiath** sunken statues of deep-sea deities.  
   **Supposed to be:** Weathered Atlantean statues.
469. **Problem:** No **Kingdom Guards** patrolling Cazzeria and Ainverth.  
   **Supposed to be:** Armored patrol NPCs.
470. **Problem:** No **Kingdom Quests** for high-level Pioneers (Lv. 70+).  
   **Supposed to be:** Endgame royal bounties.
471. **Problem:** No **Inventoria** return-to-previous-location memory.  
   **Supposed to be:** Returns player to exact spot before entering Inventoria.
472. **Problem:** No **Ruluiath** escape portal back to Fifticia Harbor.  
   **Supposed to be:** Working return whirlpool.
473. **Problem:** No **Rabituza** escape portal back to Thirdrema back-alley.  
   **Supposed to be:** Working return rune door.
474. **Problem:** No **Cazzeria/Ainverth** map borders or cliffs preventing players from falling off the island edge.  
   **Supposed to be:** Natural sea cliffs and guardrails.
475. **Problem:** No **Ruluiath** seabed rocks, trenches, or shipwrecks around the city perimeter.  
   **Supposed to be:** Rich ocean-floor perimeter.
476. **Problem:** No **Rabituza** bamboo fence detailing around the town.  
   **Supposed to be:** Feudal bamboo perimeter fencing.
477. **Problem:** No **Vysache Tenshu** lantern-lit stone steps leading up to the keep.  
   **Supposed to be:** Grand stepped approach.
478. **Problem:** No **Ruluiath** glowing rune floor mosaic in the central square.  
   **Supposed to be:** Illuminated abyssal sigil on the plaza floor.
479. **Problem:** No **Ainverth** bridge toll/lore guard.  
   **Supposed to be:** Interactive royal bridge guard.
480. **Problem:** No **Cazzeria** heraldic shield props.  
   **Supposed to be:** Painted kingdom shields on walls.
481. **Problem:** No **Inventoria** ambient floating dust motes.  
   **Supposed to be:** Mystical subspace particles.
482. **Problem:** No **CharacterCreationStudio** music/ambience.  
   **Supposed to be:** Calm creation-screen synth/harp loop.
483. **Problem:** No **Rabituza** anvil spark/steam VFX at the smithy.  
   **Supposed to be:** Active forge particles.
484. **Problem:** No **Ruluiath** sunken treasure chests (`ProximityPrompt`).  
   **Supposed to be:** Hidden abyssal loot chests.
485. **Problem:** No **Cazzeria** royal fountain.  
   **Supposed to be:** Ornate stone fountain.
486. **Problem:** No **Ainverth** royal fountain.  
   **Supposed to be:** Ornate stone fountain.
487. **Problem:** No **Kingdom** shopkeepers.  
   **Supposed to be:** Royal quartermasters selling high-tier potions.
488. **Problem:** No **Rabituza** night-time paper lantern glow.  
   **Supposed to be:** Warm paper lantern lighting.
489. **Problem:** No **Ruluiath** tentacle silhouette warning near the abyssal trench.  
   **Supposed to be:** Atmospheric foreshadowing.
490. **Problem:** No **Inventoria** storage UI integration in `SLFClient`.  
   **Supposed to be:** Working item deposit/withdraw.
491. **Problem:** No **Kingdom** fast-travel beacons.  
   **Supposed to be:** Unlockable royal shrines.
492. **Problem:** No **Rabituza** arena wave counter billboard.  
   **Supposed to be:** In-world round counter.
493. **Problem:** No **Ruluiath** chalice status indicators (lit vs shattered).  
   **Supposed to be:** Visual state on each chalice.
494. **Problem:** No **Ainverth** coastal lighthouse.  
   **Supposed to be:** Northern beacon.
495. **Problem:** No **Cazzeria** southern harbor dock.  
   **Supposed to be:** Small royal pier.
496. **Problem:** No **Rabituza** `Honorary Rabituzan` statue/recognition dialogue from citizens.  
   **Supposed to be:** Citizens react to your title.
497. **Problem:** No **Ruluiath** `Inversion` post-processing color shift.  
   **Supposed to be:** Subtle underwater tint.
498. **Problem:** No **Inventoria** key-item check before entry.  
   **Supposed to be:** Lore-accurate subspace key check.
499. **Problem:** No **CharacterCreationStudio** camera zoom presets (face vs full-body).  
   **Supposed to be:** Clean preview framing.
500. **Problem:** No **Hidden Cities** clear visual map separation.  
   **Supposed to be:** Distinct sky/lighting per hidden realm.

## 6. Biomes, Dungeons & Landmarks (Forests, Ruins, Lakes, Sanctuaries)

501. **Problem:** `BiomesFloraAndMining` contains **45+ duplicate `AncientRedwood_JumpingWoods`** folders cluttering the hierarchy.  
   **Supposed to be:** Consolidated clean `AncientRedwoodWoods` folder with varied non-overlapping trees.
502. **Problem:** `BiomesFloraAndMining` contains **24 duplicate `WindsweptAlpinePine`** folders.  
   **Supposed to be:** Consolidated `AlpinePineForest` folder.
503. **Problem:** `BiomesFloraAndMining` contains **11 duplicate `FeudalBambooGrove` and `BloomingSakuraTree`** folders.  
   **Supposed to be:** Consolidated `RabituzaFlora` folder.
504. **Problem:** `TheRampantForest` (`跳梁跋扈の森`) has `RampantOak_*` trees, but still has a few giant dark-trunk/white-wall leftovers (`steps/2466/media_0.jpg`).  
   **Supposed to be:** Clean pure forest trail without leftover blocky walls.
505. **Problem:** `TheRampantForest` has only 1 `Forest Wolf Packleader` in `SLFEnemies`.  
   **Supposed to be:** Packs of Forest Wolves, Goblin scouts, and leaping woodland mobs.
506. **Problem:** `Diremarsh Waste` (`四駆八駆の沼荒野`, `980, 18, 60`) uses `91` primitive `DiremarshAndMiningQuarry` blocks.  
   **Supposed to be:** Muddy bog pools, dead gnarled trees, mist, and wooden boardwalks.
507. **Problem:** `Diremarsh Waste` only has 1 `Quagmire Frog` and 1 `Mud Digger`.  
   **Supposed to be:** Swamp frog packs, ambush serpents, and toxic bog hazards.
508. **Problem:** `Ruins of Past Glories` (`無果落耀の古城骸`, `-600, 62, -800`) has a flat `FacilityFloor` pad with `8` primitive ribcage arches.  
   **Supposed to be:** Atmospheric ruined Ancient Era arena with broken columns, rubble, and tech terminals.
509. **Problem:** `Ruins of Past Glories` mobs (`WorkerGolem_1`, `CannonballGolem_1`, `SwordGolem_1`, `BugBomb_1`, `TimeEarner_1`) are basic block figures.  
   **Supposed to be:** Articulated high-detail golem/automaton models.
510. **Problem:** `Iron Ruin of the Divinity` (`541, 55, 423`) is literally **4 children**.  
   **Supposed to be:** Full Ancient Era rusted-iron bunker/ruin with collapsed domes and golems.
511. **Problem:** `WeaponsDevelopmentLab_Bunker` is literally **3 children**.  
   **Supposed to be:** Subterranean Ancient Era tech lab with capsules, consoles, and robot guards.
512. **Problem:** `SubterraneanLabyrinthOfTragicJadeGloom` is literally **3 children**.  
   **Supposed to be:** Green-lit underground labyrinth with jade pillars and traps.
513. **Problem:** `FloatingSeaOfWovenClouds_Sanctuary` is literally **3 children**.  
   **Supposed to be:** Sky-island cloud sanctuary with floating stone platforms and wind shrines.
514. **Problem:** `GreatCraterOfZenithDecay` is literally **3 children**.  
   **Supposed to be:** Massive scarred impact crater with scorched obsidian and magma/decay vents.
515. **Problem:** `Deathcrater Lake of Fortunes` (`-60, 40, -280`) is only **8 children**.  
   **Supposed to be:** Crater lake with real water basin, shoreline rocks, and fortune shrine.
516. **Problem:** `Tearlight Lake (Secret Area)` (`-580, 42, 180`) is only **8 children**.  
   **Supposed to be:** Luminous moonlit-style crystal-clear secret lake with glowing lilies.
517. **Problem:** `Barren Darkruin` (`-1350, 44, -460`) is only **8 children**.  
   **Supposed to be:** Desolate scorched dark-stone ruins with cursed braziers and undead/shadow mobs.
518. **Problem:** `Magnanimous Sanctuary` (`-1350, 52, 520`) is only **8 children**.  
   **Supposed to be:** Grand serene stone sanctuary with sacred grove, statues, and healing spring.
519. **Problem:** `The Severed Sea` (`-2350, 4, 200`) is only **8 children**.  
   **Supposed to be:** Stormy/mystical sea boundary with jagged sea stacks, whirlpool, and mist.
520. **Problem:** Only **4** `HarvestableHerb_1..4` nodes exist across the entire continent.  
   **Supposed to be:** Dozens of biome-appropriate herbs, ores, and mushrooms.
521. **Problem:** `AncientRedwood_JumpingWoods` trees are primitive brown cylinders + flat green discs.  
   **Supposed to be:** Tall redwood trunks with layered realistic foliage.
522. **Problem:** `WindsweptAlpinePine` trees are stacked green wedges/cones.  
   **Supposed to be:** Detailed snow-dusted pine meshes.
523. **Problem:** `ContinentWideFloraAndClutter` (`243` children) scatters primitive rocks/bushes randomly.  
   **Supposed to be:** Curated biome-matched props and rocks.
524. **Problem:** `IronRuinOfTheDivinity` has zero enemies or loot.  
   **Supposed to be:** Ancient automaton defenders and relic chests.
525. **Problem:** `WeaponsDevelopmentLab_Bunker` is not listed in `SLFConfig.Locations`.  
   **Supposed to be:** Registered location with banner and coordinates.
526. **Problem:** `SubterraneanLabyrinthOfTragicJadeGloom` is not in `SLFConfig.Locations`.  
   **Supposed to be:** Registered location with banner and coordinates.
527. **Problem:** `FloatingSeaOfWovenClouds_Sanctuary` is not in `SLFConfig.Locations`.  
   **Supposed to be:** Registered location with banner and coordinates.
528. **Problem:** `GreatCraterOfZenithDecay` is not in `SLFConfig.Locations`.  
   **Supposed to be:** Registered location with banner and coordinates.
529. **Problem:** `The Rampant Forest` lacks a dirt/cobblestone path visibly connecting Firstia to Secondil.  
   **Supposed to be:** Clear winding forest trail between city gates.
530. **Problem:** `Diremarsh Waste` lacks sinking mud slow-zones.  
   **Supposed to be:** Mud patches that slightly slow movement unless jumping/stepping on boardwalks.
531. **Problem:** `Deathcrater Lake` has no crater terrain depression carved underneath it.  
   **Supposed to be:** Real sculpted crater basin filled with water.
532. **Problem:** `Tearlight Lake` has no mountain-ringed secret valley carved around it.  
   **Supposed to be:** Hidden basin surrounded by rocky ridges.
533. **Problem:** `Barren Darkruin` sits on bright green grass instead of scorched dark ground/basalt.  
   **Supposed to be:** Painted `Basalt`/`Mud`/`CrackedLava` terrain under the ruins.
534. **Problem:** `Magnanimous Sanctuary` lacks sacred healing spring mechanics.  
   **Supposed to be:** Standing in the sanctuary spring slowly restores HP/MP/STM.
535. **Problem:** `The Severed Sea` lacks dramatic wave/horizon storm boundary.  
   **Supposed to be:** Atmospheric sea mist and sea-stack pillars.
536. **Problem:** `OverdressGolem_Boss` stands static in Ruins of Past Glories without boss HP bar or arena trigger.  
   **Supposed to be:** Full Overdress Golem boss fight with armor-break phase.
537. **Problem:** `RuinsOfPastGlories` `RibSeg_*` arches (`steps/2364/media_0.jpg`) have visible blocky segment gaps.  
   **Supposed to be:** Smoothly joined Ancient Era rib-arch trusses.
538. **Problem:** No mining quarry ores inside `DiremarshAndMiningQuarry`.  
   **Supposed to be:** Interactive copper/iron/coal nodes.
539. **Problem:** No wooden bridges over Diremarsh streams.  
   **Supposed to be:** Rotting swamp plank bridges.
540. **Problem:** No fireflies/spores in Diremarsh Waste or Rampant Forest.  
   **Supposed to be:** Subtle biome particle emitters.
541. **Problem:** No fallen hollow logs or mossy stumps in The Rampant Forest.  
   **Supposed to be:** Natural forest floor detail.
542. **Problem:** No secret cave shortcut bypassing Diremarsh.  
   **Supposed to be:** Optional high-risk/high-reward side trail.
543. **Problem:** No warning signs outside `Barren Darkruin` (`-1350, -460`).  
   **Supposed to be:** Skulls/warning stakes noting high-level danger.
544. **Problem:** No pilgrim lanterns leading to `Magnanimous Sanctuary` (`-1350, 520`).  
   **Supposed to be:** Stone lanterns marking the sanctuary path.
545. **Problem:** No sunken ruins visible along `Severed Sea` coastline.  
   **Supposed to be:** Half-submerged pillars hinting at Ruluiath.
546. **Problem:** No **Area Discovery** banners triggering for the 4 extra hidden biomes (`Lab`, `Jade Gloom`, `Woven Clouds`, `Zenith Decay`).  
   **Supposed to be:** Full location trigger coverage.
547. **Problem:** No biome-specific `SLFEnemies` spawns in `Barren Darkruin`, `Deathcrater Lake`, `Iron Ruin`, or `Jade Gloom`.  
   **Supposed to be:** Populated monster ecosystems per biome.
548. **Problem:** No altitude-based temperature/snow line blending in Alpine zones.  
   **Supposed to be:** Gradual grass -> rock -> snow terrain transitions.
549. **Problem:** No river water connecting `Deathcrater Lake` to `Severed Sea`.  
   **Supposed to be:** Continuous river drainage.
550. **Problem:** No waterfalls on mountain cliffs.  
   **Supposed to be:** Particle waterfalls and splash pools.
551. **Problem:** `WesternPlainsFlora` and `OuterPeninsulasAndWilds` only use `Tpl_OakTree`, lacking pine/cypress/dead-tree variety.  
   **Supposed to be:** Multi-species tree variety per latitude/biome.
552. **Problem:** `WildBoulder_*` (`27` boulders) are smooth stretched `Ball` shapes.  
   **Supposed to be:** Faceted/sculpted `Rock` boulder formations.
553. **Problem:** No tall grass/fern clusters around `Tpl_OakTree` bases.  
   **Supposed to be:** Understory shrubs and ferns.
554. **Problem:** No ruins/watchtowers along the central mountain ridge passes.  
   **Supposed to be:** Mountain-pass checkpoints.
555. **Problem:** No treasure chests hidden in `Tearlight Lake` or `Hidden Garden`.  
   **Supposed to be:** Rewarding exploration chests.
556. **Problem:** No `Day/Night` bioluminescence on `Tearlight Lake` or `Hidden Garden` flowers.  
   **Supposed to be:** Glowing night flora.
557. **Problem:** No `GreatCraterOfZenithDecay` scorched terrain crater.  
   **Supposed to be:** Deep impact crater painted with `CrackedLava`/`Basalt`.
558. **Problem:** No `FloatingSeaOfWovenClouds` altitude placement (sits near ground level instead of high sky `Y > 300`).  
   **Supposed to be:** Elevated sky-island sanctuary with cloud-beam/wind-updraft access.
559. **Problem:** No `WeaponsDevelopmentLab` interior lighting or Ancient Era terminals.  
   **Supposed to be:** Flickering cyan lab consoles.
560. **Problem:** No `SubterraneanLabyrinthOfTragicJadeGloom` underground placement (`Y < 10`).  
   **Supposed to be:** True subterranean jade maze.
561. **Problem:** No fishing spots at `Deathcrater Lake` and `Tearlight Lake`.  
   **Supposed to be:** Interactive fishing nodes.
562. **Problem:** No lore tablets in `IronRuinOfTheDivinity`.  
   **Supposed to be:** Readable Ancient Era lore.
563. **Problem:** No `OverdressGolem` guard patrol / aggro radius in Ruins of Past Glories.  
   **Supposed to be:** Active boss AI and loot drops.
564. **Problem:** No `WorkerGolem` / `SwordGolem` / `CannonballGolem` distinct attack behaviors.  
   **Supposed to be:** Unique melee, ranged cannon, and swarm-bomb AI.
565. **Problem:** No `TimeEarner` fast-evasive movement behavior.  
   **Supposed to be:** High-AGI elusive mob behavior.
566. **Problem:** No `BugBomb` self-destruct telegraph.  
   **Supposed to be:** Flashing countdown explosion.
567. **Problem:** No mushroom/herb regrowth timers after harvesting.  
   **Supposed to be:** Respawning gathering nodes.
568. **Problem:** No quarry/minecart tracks in `DiremarshAndMiningQuarry`.  
   **Supposed to be:** Industrial mining rails and ore carts.
569. **Problem:** No burnt/dead trees in `Barren Darkruin` and `Great Crater`.  
   **Supposed to be:** Charred/withered dead-tree models.
570. **Problem:** No wind-swept snow particles on the central mountain peaks.  
   **Supposed to be:** Alpine snowdrift VFX.
571. **Problem:** No clear trail markers connecting `Fourfolkshire` -> `Canyon` -> `Eighthold` -> `Ruins` -> `Eleventar`.  
   **Supposed to be:** Continuous northern route signage.
572. **Problem:** No clear trail markers connecting `Thirdrema` -> `Fivelle` -> `Sevenburg` -> `Twelmus`.  
   **Supposed to be:** Continuous central route signage.
573. **Problem:** No clear trail markers connecting `Thirdrema` -> `Sixenveldt` -> `Nineshill` -> `Tenverdt`.  
   **Supposed to be:** Continuous southern route signage.
574. **Problem:** No roadside shrines/campfires where Pioneers can heal between distant cities.  
   **Supposed to be:** Waystation campfires.
575. **Problem:** No `Terrain` beach sand border around the entire island coastline (many cliffs drop straight from green grass into water).  
   **Supposed to be:** Natural sand/rock coastal transitions.
576. **Problem:** No submerged seabed rocks/sandbar transition around the continent's shallow coasts.  
   **Supposed to be:** Gradual shallow-to-deep ocean shelf.
577. **Problem:** No `Lycagon` nighttime spawn zone marked in wilds.  
   **Supposed to be:** Moonlit clearing encounter zone.
578. **Problem:** No `Diremarsh` toxic fog volume.  
   **Supposed to be:** Low-lying greenish swamp mist.
579. **Problem:** No `Magnanimous Sanctuary` marble/gold trim.  
   **Supposed to be:** Sacred white-and-gold temple architecture.
580. **Problem:** No `Hidden Garden` moon-petal collectibles.  
   **Supposed to be:** Secret alchemy ingredients.
581. **Problem:** No `IronRuin` rusted mech/golem wreckage.  
   **Supposed to be:** Environmental storytelling props.
582. **Problem:** No `CrystalNestCliff` <-> `RuinsOfPastGlories` natural mountain barrier.  
   **Supposed to be:** Distinct ridge separating crystal cliffs from the tech ruins.
583. **Problem:** No `Deathcrater Lake` central island shrine.  
   **Supposed to be:** Accessible shrine island in the crater lake.
584. **Problem:** No `Tearlight Lake` weeping-willow / luminous tree centerpiece.  
   **Supposed to be:** Signature glowing lakeside tree.
585. **Problem:** No `The Rampant Forest` alpha-wolf den clearing.  
   **Supposed to be:** Distinct clearing for Packleader.
586. **Problem:** No `FirstiaFarmlands` scarecrows, hay bales, or barn.  
   **Supposed to be:** Detailed pastoral farmland props.
587. **Problem:** No `ContinentWildernessFill` variety in ground cover (only `LeafyGrass` circles).  
   **Supposed to be:** Blended `Ground`, `LeafyGrass`, and `Mud` paths.
588. **Problem:** No `BiomesFloraAndMining` cleanup of legacy `ContinentWideFloraAndClutter` primitive blocks.  
   **Supposed to be:** Full replacement with mesh/terrain-matched assets.
589. **Problem:** No cave-in or rubble props blocking unimplemented deep tunnels cleanly.  
   **Supposed to be:** Intentional lore-friendly cave barriers.
590. **Problem:** No weather-reactive puddle/wetness or fog in `Severed Sea`.  
   **Supposed to be:** Atmospheric coastal storm zone.
591. **Problem:** No biome audio crossfade controller.  
   **Supposed to be:** Smooth ambient music/SFX crossfade per biome.
592. **Problem:** No exploration completion percentage (`X / 32 Locations Discovered`).  
   **Supposed to be:** Tracker in `SLFClient`.
593. **Problem:** No world-map UI showing all 32 canon locations with discovered/undiscovered pins.  
   **Supposed to be:** Interactive `M`-key world map.
594. **Problem:** No compass bar at top of screen showing nearby cities and landmarks.  
   **Supposed to be:** RPG compass HUD.
595. **Problem:** No lore journal recording discovered biomes and monsters.  
   **Supposed to be:** Codex tab in menu.
596. **Problem:** No seasonal/time-of-day sky tinting for special zones.  
   **Supposed to be:** Dynamic skybox/atmosphere presets.
597. **Problem:** No collision-free forest undergrowth (tall grass `CanCollide = false`).  
   **Supposed to be:** Walk-through foliage.
598. **Problem:** No cliff-edge safety or climbing/stamina interaction.  
   **Supposed to be:** Consistent traversal feel.
599. **Problem:** No biome-specific monster drop tables in `SLFServer`.  
   **Supposed to be:** Distinct crafting drops per biome.
600. **Problem:** No unified `BiomesFloraAndMining` naming convention (mix of `_WikiAccurate`, `_Cavern`, `_Bunker`, bare names).  
   **Supposed to be:** Clean standardized folder hierarchy.

## 7. Terrain, Hydrology, Roads & World-Scale Architecture

601. **Problem:** `HydrologyAndRoads` has `201` separate small `Part` road dashes instead of smooth continuous roads.  
   **Supposed to be:** Terrain-painted roads (`Cobblestone`/`Asphalt`/`Ground`) or smooth curved road segments.
602. **Problem:** Road dashes float slightly above or sink beneath undulating terrain (`steps/2484/media_0.jpg`).  
   **Supposed to be:** Terrain-conformed road surface.
603. **Problem:** `Fifticia` sits on a visibly square artificial terrain plateau (`steps/2484/media_0.jpg`).  
   **Supposed to be:** Natural rounded coastal peninsula and harbor bay.
604. **Problem:** `AinverthKingdom` sits on a visibly circular cylinder terrain pad (`steps/2512/media_0.jpg`).  
   **Supposed to be:** Natural northern headland.
605. **Problem:** Central mountain range has repetitive blocky/cone-like peak silhouettes (`steps/2484/media_0.jpg`).  
   **Supposed to be:** Varied jagged ridges, valleys, and passes.
606. **Problem:** Snow caps on mountains stop in flat horizontal circles.  
   **Supposed to be:** Natural noise-blended snowline.
607. **Problem:** Terrain coast has jagged voxel-step edges along parts of the southern and western shore.  
   **Supposed to be:** Smoothed `Terrain` coastline transitions.
608. **Problem:** No rivers visibly carving valleys from mountain lakes to the sea.  
   **Supposed to be:** Continuous carved riverbeds filled with `Terrain` water.
609. **Problem:** No bridges where major highways cross rivers or gorges.  
   **Supposed to be:** Stone arch and timber bridges at every water/gorge crossing.
610. **Problem:** `Workspace.Terrain` water level (`Y = 0`) vs `Ruluiath` (`Y = -92`) lacks a smooth deep-ocean trench.  
   **Supposed to be:** Sculpted abyssal trench around Ruluiath.
611. **Problem:** `Ruluiath` sits in dry-looking air/sand (`steps/2465/media_0.jpg`) rather than submerged inside `Terrain` water.  
   **Supposed to be:** Actually submerged or enclosed in an inverted ocean-dome pocket.
612. **Problem:** Cities 5–14 sit on flat grey circular pads cut into green grass.  
   **Supposed to be:** Natural town foundations with curbed stone edges.
613. **Problem:** No terrain elevation variation inside cities (every city is 100% flat).  
   **Supposed to be:** Gentle terraces, steps, and raised keep plateaus.
614. **Problem:** `Eighthold` canal water uses flat cyan `Part` instead of `Terrain` water or animated water surface.  
   **Supposed to be:** Clear reflective water with visible canal bed.
615. **Problem:** `Eleventar` basin water uses flat bright cyan `Part` (`steps/2449/media_0.jpg`).  
   **Supposed to be:** Translucent shimmering water with fountain ripple VFX.
616. **Problem:** `Fourfolkshire` and `Thirdrema` sit close to steep mountain walls without retaining cliffs.  
   **Supposed to be:** Clean stone retaining walls.
617. **Problem:** No paved road connecting `Firstia` -> `Rampant Forest` -> `Secondil` -> `Thirdrema` cleanly.  
   **Supposed to be:** Unbroken East-West Royal Highway.
618. **Problem:** No paved road connecting `Thirdrema` -> `Fourfolkshire` -> `Canyon` -> `Eighthold` -> `Ruins` -> `Eleventar`.  
   **Supposed to be:** Unbroken Northern Frontier Highway.
619. **Problem:** No road connecting `Thirdrema` -> `Sixenveldt` -> `Nineshill` -> `Tenverdt` -> `Cazzeria`.  
   **Supposed to be:** Unbroken Southern Highway.
620. **Problem:** No road connecting `Eleventar` -> `Twelmus` -> `Thirteed` -> `Fourtian` -> `Fifticia`.  
   **Supposed to be:** Unbroken Western Coast Highway.
621. **Problem:** No cross-continent mountain tunnel connecting `Nineshill` (`-280, 560`) and `Sevenburg` (`-320, -120`).  
   **Supposed to be:** Carved mountain pass.
622. **Problem:** No road signs or stone distance pillars at highway intersections.  
   **Supposed to be:** Every fork has clear directional signage.
623. **Problem:** `Terrain.Decoration` (3D grass blades) is not leveraged across meadowlands.  
   **Supposed to be:** Lush swaying 3D terrain grass in plains.
624. **Problem:** No sandbars, coastal reefs, or small offshore islets around the continent.  
   **Supposed to be:** Natural archipelago/reef details.
625. **Problem:** `Severed Sea` (`-2350, 200`) lacks boundary fog/currents to explain why players can't swim across.  
   **Supposed to be:** Lore-consistent sea barrier.
626. **Problem:** `SLFConfig.Locations` Y-coordinates don't always match actual terrain surface Y (e.g., `Eleventar` `Y=58` vs sample `64`, `Thirdrema` `Y=82` vs `57`).  
   **Supposed to be:** All 32 spawn/banner Y-coordinates raycast-calibrated to exact ground height.
627. **Problem:** Overlapping location radii (`Canyon` + `Crystal Nest Cliff` overlap; `Fourfolkshire` + `Crystal Nest Cliff` touch).  
   **Supposed to be:** Clean non-overlapping zone trigger polygons/radii.
628. **Problem:** No road lanterns along the main Firstia–Secondil–Thirdrema starter highway.  
   **Supposed to be:** Lantern posts at intervals along starter roads.
629. **Problem:** No roadside inns, stables, or ruined guardposts between distant cities.  
   **Supposed to be:** Atmospheric roadside POIs.
630. **Problem:** No cliffside guardrails along high mountain roads.  
   **Supposed to be:** Wooden/stone safety parapets.
631. **Problem:** `Terrain` under `Ruins of Past Glories` was carved flat in a square block.  
   **Supposed to be:** Natural cratered ruin rim.
632. **Problem:** `Rabituza` plateau at `(1050, 144, -1080)` is visibly perched on top of the northern mountain.  
   **Supposed to be:** Tucked into a secluded mountain bowl/valley.
633. **Problem:** No snow/ice cave or alpine ridge path leading toward Siegwurm's peak.  
   **Supposed to be:** High-altitude dragon ascent trail.
634. **Problem:** No harbor breakwater wall at `Fifticia`.  
   **Supposed to be:** Stone breakwater protecting the galleons.
635. **Problem:** No lighthouse peninsula jutting out cleanly at `Fifticia`.  
   **Supposed to be:** Dedicated rocky headland for the lighthouse.
636. **Problem:** No canal locks or water-gates in `Eighthold` and `Eleventar`.  
   **Supposed to be:** Architectural waterworks.
637. **Problem:** No visible farm terraces around `Firstia` and `Secondil`.  
   **Supposed to be:** Tiered countryside farms.
638. **Problem:** No mine entrances carved into the hillsides near `DiremarshAndMiningQuarry`.  
   **Supposed to be:** Timber-framed mine adits.
639. **Problem:** No rock arches or natural stone bridges in the central highlands.  
   **Supposed to be:** Scenic natural landmarks.
640. **Problem:** No world-boundary invisible/lore wall preventing swimming infinitely into empty ocean.  
   **Supposed to be:** Clean ocean boundary warning + warp-back.
641. **Problem:** `HydrologyAndRoads` parts are ungrouped in one flat folder of 201 items.  
   **Supposed to be:** Grouped into `Highways`, `Rivers`, `Bridges`, `Signposts`.
642. **Problem:** `CazzeriaKingdom` sits near the southern coast without harbor or mountain integration.  
   **Supposed to be:** Integrated coastal/hillside citadel terrain.
643. **Problem:** No consistent road width (some dashes are 12 studs, some 20+).  
   **Supposed to be:** Standardized 18-stud main highways, 10-stud forest trails.
644. **Problem:** No dirt-to-cobblestone transition aprons outside city gates.  
   **Supposed to be:** Smooth material blending.
645. **Problem:** No fallen boulders or landslides on the `Barren Darkruin` road.  
   **Supposed to be:** Environmental storytelling.
646. **Problem:** No bridge over the `Tearlight Lake` outlet.  
   **Supposed to be:** Delicate wooden footbridge.
647. **Problem:** No stepped stone stairs up to `Magnanimous Sanctuary`.  
   **Supposed to be:** Grand pilgrim staircase.
648. **Problem:** No crater rim path around `Deathcrater Lake of Fortunes`.  
   **Supposed to be:** Walkable scenic rim trail.
649. **Problem:** No `Terrain` material painting (`Mud`, `Pavement`, `Ground`, `Rock`) under structures—many sit on bright `Grass`.  
   **Supposed to be:** Proper `Ground`/`Cobblestone` terrain under buildings.
650. **Problem:** No automated terrain-height sync script for `SLFConfig.Locations`.  
   **Supposed to be:** Startup/editor calibration utility.
651. **Problem:** No waterfall mist or river flow sound near bridges.  
   **Supposed to be:** Spatial water audio.
652. **Problem:** No coastal cliffs along the southeast/northeast edges (`steps/2494/media_0.jpg` shows smooth green slopes dipping into water).  
   **Supposed to be:** Natural rocky coastline.
653. **Problem:** `SEPeninsula_Beacon` sits on bare green grass with no stone base pad or path.  
   **Supposed to be:** Stone courtyard pad and coastal trail.
654. **Problem:** `NWPeninsula_Watchtower` has no connecting trail to `AinverthKingdom` or `Eleventar`.  
   **Supposed to be:** Coastal patrol trail.
655. **Problem:** `SWPeninsula_Ruins` has no connecting trail to `Fifticia` or `Fourtian`.  
   **Supposed to be:** Ancient ruin footpath.
656. **Problem:** `NEPeninsula_Shrine` has no connecting trail to `Firstia` or `Fourfolkshire`.  
   **Supposed to be:** Cliffside shrine path.
657. **Problem:** No `Vorpal` monoliths/obelisk landmarks in the wilds.  
   **Supposed to be:** Ancient Vorpal monuments.
658. **Problem:** No `Canyon` vertical ropeways or ladders.  
   **Supposed to be:** Climbable truss/ladder paths.
659. **Problem:** No `Eleventar` perimeter wall gates clearly aligned with incoming roads.  
   **Supposed to be:** Road-aligned city gates.
660. **Problem:** No `Eighthold` perimeter wall/quay barrier on the north/south flanks.  
   **Supposed to be:** Cohesive canal-city border walls.
661. **Problem:** No `Thirdrema` outer moat or defensive ditch.  
   **Supposed to be:** Grand royal moat and drawbridge.
662. **Problem:** No `Secondil` fortified barbican/portcullis.  
   **Supposed to be:** Iron portcullis detail.
663. **Problem:** No `Firstia` welcoming arch banner.  
   **Supposed to be:** Town of Beginnings entry arch.
664. **Problem:** No `Nineshill` terraced amphitheater/plaza.  
   **Supposed to be:** Multi-level southern hub layout.
665. **Problem:** No `Fifticia` underworld sewer/alley entrance grate.  
   **Supposed to be:** Interactive grate leading to Shadow Quarter.
666. **Problem:** No `Ruluiath` sunken aqueducts.  
   **Supposed to be:** Broken Atlantean aqueduct arches.
667. **Problem:** No `Rabituza` koi/lotus pond.  
   **Supposed to be:** Serene feudal garden pond.
668. **Problem:** No `Crystal Nest Cliff` jagged obsidian/slate base.  
   **Supposed to be:** Dark mineral cliff base.
669. **Problem:** No `Prismatic Forest Grotto` subterranean river.  
   **Supposed to be:** Glowing cave stream.
670. **Problem:** No `Iron Ruin` collapsed iron tower.  
   **Supposed to be:** Tilted rusted mega-structure.
671. **Problem:** No `Weapons Development Lab` blast doors.  
   **Supposed to be:** Half-open Ancient Era vault doors.
672. **Problem:** No `Great Crater` glowing fissure lines.  
   **Supposed to be:** Cracked energy fissures.
673. **Problem:** No `Floating Sea of Woven Clouds` cloud-platform ring.  
   **Supposed to be:** Layered sculpted cloud islands.
674. **Problem:** No `Jade Gloom` glowing jade obelisks.  
   **Supposed to be:** Emerald-lit labyrinth markers.
675. **Problem:** No `Barren Darkruin` broken gothic arches.  
   **Supposed to be:** Shattered dark stone ruins.
676. **Problem:** No `Magnanimous Sanctuary` marble colonnade.  
   **Supposed to be:** Restored sacred temple.
677. **Problem:** No `Hidden Garden` hedge maze / floral arch.  
   **Supposed to be:** Enchanted garden entrance.
678. **Problem:** No `Deathcrater Lake` volcanic vents.  
   **Supposed to be:** Bubbling mineral vents.
679. **Problem:** No `Tearlight Lake` crystal-clear shallow shore.  
   **Supposed to be:** Shimmering translucent shallows.
680. **Problem:** No `Severed Sea` lighthouse/buoy markers.  
   **Supposed to be:** Navigational sea beacons.
681. **Problem:** No `Continent` skybox cloud layer matching high-altitude mountains.  
   **Supposed to be:** Layered distant clouds.
682. **Problem:** No `Sun` directional alignment casting dramatic shadows across gates and valleys.  
   **Supposed to be:** Tuned `ClockTime` / `GeographicLatitude`.
683. **Problem:** No `Terrain` water color/transparency tuning per region (Fifticia harbor vs Ruluiath abyss).  
   **Supposed to be:** Richer deep-teal ocean water.
684. **Problem:** No `Terrain` water wave speed/size tuning.  
   **Supposed to be:** Natural ocean swell.
685. **Problem:** No `SLFWorld` spatial grid/chunk organization for fast streaming if re-enabled.  
   **Supposed to be:** Modular city/biome `Model` containers with `Persistent` landmarks.
686. **Problem:** No `SpawnLocation` safety check ensuring players never spawn inside terrain or water.  
   **Supposed to be:** Raycast-verified spawn pads.
687. **Problem:** No `Wanderer` origin forest-camp spawn props in The Rampant Forest.  
   **Supposed to be:** Campfire & bedroll spawn point.
688. **Problem:** No `Cazzeria` mountain backdrop.  
   **Supposed to be:** Southern highland ridge.
689. **Problem:** No `Ainverth` northern sea-cliff bridge.  
   **Supposed to be:** Grand stone viaduct.
690. **Problem:** No `Eighthold` rooftop chimneys & dormers.  
   **Supposed to be:** Detailed European roofline variety.
691. **Problem:** No `Eleventar` sloped cobblestone plaza.  
   **Supposed to be:** Stepped circular fountain terrace.
692. **Problem:** No `Thirdrema` palace garden hedges.  
   **Supposed to be:** Topiary & floral royal gardens.
693. **Problem:** No `Firstia` town belltower.  
   **Supposed to be:** Starter town clock/bell landmark.
694. **Problem:** No `Secondil` watchtower battlements.  
   **Supposed to be:** Walkable lookout towers.
695. **Problem:** No `Fourfolkshire` windmill/waterwheel.  
   **Supposed to be:** Fairytale waterwheel beside the stream.
696. **Problem:** No `Fivelle–Fourtian` unique regional monuments.  
   **Supposed to be:** 10 distinct regional landmarks.
697. **Problem:** No `WorldMap` coordinate grid alignment check.  
   **Supposed to be:** Verified map-to-3D coordinate parity.
698. **Problem:** No `Road` spline smoothness (straight/angular segments).  
   **Supposed to be:** Curved multi-segment roads.
699. **Problem:** No `Cliff` rock-face meshes covering stretched terrain polygons.  
   **Supposed to be:** Sculpted cliff rock meshes.
700. **Problem:** No `Continent` heightmap verification report.  
   **Supposed to be:** Zero below-sea-level city centers.

## 8. Combat, Enemies, AI, Boss Mechanics & Loot (SLFEnemies & SLFServer)

701. **Problem:** Only `17` total enemies exist across the entire 4400×3000 stud continent.  
   **Supposed to be:** 150+ spawned enemies across all biomes and level brackets.
702. **Problem:** Only `14` unique enemy types exist (`SLFEnemies`).  
   **Supposed to be:** 40+ canon enemy species across Lv. 1 to Lv. 150+.
703. **Problem:** Enemies stand frozen or move with basic direct-line pursuit without pathfinding.  
   **Supposed to be:** `PathfindingService` navigation around walls and cliffs.
704. **Problem:** No enemy attack animations or wind-up telegraphs.  
   **Supposed to be:** Animated swing/lunge/cast telegraphs.
705. **Problem:** No enemy knockback, hit-flash, or damage number popups.  
   **Supposed to be:** Floating damage numbers (`Crit!`, `Weak!`, `Resist`).
706. **Problem:** No enemy aggro/leash radius resetting HP when pulled too far.  
   **Supposed to be:** Clean leash/reset behavior.
707. **Problem:** No enemy respawn timer visual or staggered spawn.  
   **Supposed to be:** Smooth respawn with spawn-in VFX.
708. **Problem:** No **Goblin / Hobgoblin / Orc** starter/mid-tier mobs.  
   **Supposed to be:** Classic frontier humanoid/beast mobs.
709. **Problem:** No **Vorpal Soul** bonus EXP/drop rate when defeating higher-level enemies solo.  
   **Supposed to be:** Canon underdog bonus (`Vorpal Soul` + extra loot).
710. **Problem:** No **Party EXP sharing** or assist credit.  
   **Supposed to be:** Fair party/multi-attacker credit.
711. **Problem:** Combat hitboxes rely on basic distance check rather than weapon swing arc/raycast.  
   **Supposed to be:** Accurate melee hitbox & ranged projectile collision.
712. **Problem:** No **Shield Block / Guard** mechanic reducing incoming damage.  
   **Supposed to be:** Right-click/key guard consuming `STM`.
713. **Problem:** No **Dodge Roll / Dash (`Q` / `Shift`)** with brief i-frames.  
   **Supposed to be:** Responsive dash consuming `STM`.
714. **Problem:** No **Skill Slots** (`1–4` / `Z,X,C`) mapped to Job-specific active skills.  
   **Supposed to be:** Active job skills wired to `SLFServer`.
715. **Problem:** No **Magic Casting (`MP`)** projectiles/AoE for Magician, Sage, Sorcerer, Priest.  
   **Supposed to be:** Cast bar, projectile/AoE VFX, and mana cost.
716. **Problem:** No **Healing / Buff** skills for Priest and Sage.  
   **Supposed to be:** Targeted/AoE heal and defense buffs.
717. **Problem:** No **Dual-Wielding** off-hand strike for Twin Blade User.  
   **Supposed to be:** 2-hit rapid combo with `AGI`/`DEX` scaling.
718. **Problem:** No **Bow/Quiver** arrow physics for Magic Archer.  
   **Supposed to be:** Arcing/homing mana arrows.
719. **Problem:** No **Fist/Qi** combo skills for Brawler, Monk, Spirit Fist User.  
   **Supposed to be:** Rapid multi-hit palm/kick skills.
720. **Problem:** No **Stealth / Shadow Clone** decoys for Ninja.  
   **Supposed to be:** Brief invisibility and kunai burst.
721. **Problem:** No **Vengeance / Counter** passive for Revenger.  
   **Supposed to be:** Bonus damage based on missing HP.
722. **Problem:** No **Ancient Craftsman** dismantle/field-craft passive.  
   **Supposed to be:** Salvage drops into rare materials.
723. **Problem:** No **Weapon Multiplier (`武器倍率`)** tooltip and formula (`STR × Multiplier`) shown clearly.  
   **Supposed to be:** Transparent damage breakdown.
724. **Problem:** No **TEC (`技量`)** visible effect on crit rate and hit precision.  
   **Supposed to be:** Higher `TEC` visibly boosts crit chance and reduces glancing hits.
725. **Problem:** No **AGI (`敏捷`)** effect on movement/attack speed.  
   **Supposed to be:** WalkSpeed/swing-speed scaling.
726. **Problem:** No **DEX (`器用`)** effect on crafting/bow/dual-wield accuracy.  
   **Supposed to be:** Precision and crafting quality scaling.
727. **Problem:** No **VIT (`耐久力`)** effect on flat defense & max HP.  
   **Supposed to be:** Armor/damage reduction scaling.
728. **Problem:** No **LUC (`幸運`)** effect on rare drop rate (`Goldie Scorpion`, Unique mats).  
   **Supposed to be:** Drop-table luck modifier.
729. **Problem:** No **Status Effects** (`Poison`, `Bleed`, `Burn`, `Paralyze`, `Curse`).  
   **Supposed to be:** Full debuff system with cleanse items.
730. **Problem:** No **Monster Weak-Point** hit detection (head/core vs armored shell).  
   **Supposed to be:** Directional/part-based damage multipliers.
731. **Problem:** No **Mob Pack AI** (Forest Wolves howling to alert packmates).  
   **Supposed to be:** Coordinated pack aggro.
732. **Problem:** No **Boss Enrage** timer or low-HP desperation phase.  
   **Supposed to be:** Phase-3 boss speed/attack escalation.
733. **Problem:** No **Loot Drop Chests / Orbs** on the ground after kills.  
   **Supposed to be:** Physical glowing drops with magnet/pickup.
734. **Problem:** No **Inventory Weight / Bag Capacity** or Inventoria overflow.  
   **Supposed to be:** Clean inventory management.
735. **Problem:** No **Consumable Items** (`Potion`, `Hi-Potion`, `Elixir`, `Stamina Jerky`, `Antidote`, `Whetstone`).  
   **Supposed to be:** Full consumable item catalog.
736. **Problem:** No **Equipment Rarity Tiers** (`Common`, `Uncommon`, `Rare`, `Epic`, `Legend`, `Unique`).  
   **Supposed to be:** Color-coded gear tiers.
737. **Problem:** No **Weapon Types** (`Dagger`, `One-Handed Sword`, `Longsword`, `Twin Blades`, `Bow`, `Staff`, `Gauntlets`, `Hammer`).  
   **Supposed to be:** All canon weapon classes.
738. **Problem:** No **Armor Slots** (`Head`, `Chest`, `Legs`, `Accessory`).  
   **Supposed to be:** Equipable armor pieces.
739. **Problem:** No **Lycagon Curse Slot Lock** preventing chest/leg equip when cursed.  
   **Supposed to be:** Canon curse restriction + bonus.
740. **Problem:** No **Blacksmith Crafting Recipes** using monster drops (`Wolf Fang`, `Crystal Shard`, `Golem Core`).  
   **Supposed to be:** Full crafting UI.
741. **Problem:** No **Shop Buy/Sell** transaction UI.  
   **Supposed to be:** Working gold (`マニー` / `Mahney`) economy.
742. **Problem:** No **Currency (`Mahney` / `マニー`)** HUD counter.  
   **Supposed to be:** Canon currency name and counter.
743. **Problem:** No **Death Screen** with cause of death and respawn countdown.  
   **Supposed to be:** Clean defeat overlay.
744. **Problem:** No **Boss Music / Combat SFX** (sword clash, magic cast, hit thud).  
   **Supposed to be:** Rich combat audio feedback.
745. **Problem:** No **Combat Idle/Walk/Run/Attack Animations** on custom enemy rigs.  
   **Supposed to be:** Keyframed/procedural limb animations.
746. **Problem:** `WorkerGolem_1`, `SwordGolem_1`, `CannonballGolem_1` look like simple static blocks.  
   **Supposed to be:** Animated articulated robot models.
747. **Problem:** `BugBomb_1` and `TimeEarner_1` lack distinct silhouettes and VFX.  
   **Supposed to be:** Glowing bomb bug & sleek clockwork/golden time-earner model.
748. **Problem:** `Vorpal Bunny Duelist` lacks sword-wielding animations and crimson-scarf look.  
   **Supposed to be:** Dynamic bunny duelist AI.
749. **Problem:** No **Training Dummy** DPS meter in cities.  
   **Supposed to be:** Target dummy for testing builds.
750. **Problem:** No **PvP Duel Challenge** request between Pioneers.  
   **Supposed to be:** 1v1 duel circle.
751. **Problem:** No **Party System** (create, invite, leave, party HP bars).  
   **Supposed to be:** 4–6 player Pioneer party HUD.
752. **Problem:** No **Raid Boss Leaderboard** (damage dealt / fastest clear).  
   **Supposed to be:** Post-boss summary card.
753. **Problem:** No **Drop Rate Transparency / Bestiary** showing monster drops.  
   **Supposed to be:** Monsterpedia tab.
754. **Problem:** No **Enemy Level Color Coding** (green = weak, white = even, red = higher-level Vorpal target).  
   **Supposed to be:** Color-coded nameplates.
755. **Problem:** No **Stamina Bar** regeneration delay after dodging/sprinting.  
   **Supposed to be:** Balanced stamina pacing.
756. **Problem:** No **Mana Bar** regeneration scaling with `Sage`/`Magician` passives.  
   **Supposed to be:** Class-based regen.
757. **Problem:** No **Boss Projectile Dodge Indicators** (red ground circles/lines).  
   **Supposed to be:** Clear AoE telegraph decals.
758. **Problem:** No **Friendly NPC Guards** assisting if a monster is lured to a city gate.  
   **Supposed to be:** Gate guards intercepting stray mobs.
759. **Problem:** No **Rare Monster Spawn Announcements** in local zone chat.  
   **Supposed to be:** Local alert when `Goldie Scorpion` or `Empire Bee Princess` spawns.
760. **Problem:** No **Quest Kill Counter** synced automatically on enemy defeat.  
   **Supposed to be:** Live quest progress toasts.
761. **Problem:** No **Quest Turn-In** rewards (EXP, Mahney, Title, Gear).  
   **Supposed to be:** Complete quest loop.
762. **Problem:** No **Repeatable Bounties** for leveling between cities.  
   **Supposed to be:** Guild bounty rotation.
763. **Problem:** No **Level Cap / Milestone** rewards (Lv. 10, 25, 50, 80, 99).  
   **Supposed to be:** Milestone unlocks.
764. **Problem:** No **Skill Point / Stat Point** auto-allocation preset or reset potion.  
   **Supposed to be:** Stat reset item.
765. **Problem:** No **Buff Icons** above hotbar (Food, Emul Buff, Sanctuary Regen).  
   **Supposed to be:** Active buff timer icons.
766. **Problem:** No **Food / Cooking** system (tavern meals granting temporary stat buffs).  
   **Supposed to be:** Inn meals.
767. **Problem:** No **Mount / Speed Boost** or Sprint toggle (`Shift`).  
   **Supposed to be:** Reliable sprint mechanic.
768. **Problem:** No **Fall Damage** on extreme cliff drops (e.g., Crystal Nest Cliff).  
   **Supposed to be:** Balanced fall damage.
769. **Problem:** No **Swimming / Drowning** stamina check in deep water.  
   **Supposed to be:** Water traversal mechanics.
770. **Problem:** No **Monster Elemental Weaknesses** (`Blunt` vs Crystal, `Fire` vs Spider/Plants).  
   **Supposed to be:** Tactical elemental system.
771. **Problem:** No **Critical Hit Audio & Screen Flash** on Vorpal strikes.  
   **Supposed to be:** Satisfying Vorpal crit feedback.
772. **Problem:** No **Enemy Healthbar** overhead showing name, level, and status icons.  
   **Supposed to be:** Clean nameplate UI.
773. **Problem:** No **Boss Phase Immunity** brief transition window.  
   **Supposed to be:** Fair phase-change invulnerability.
774. **Problem:** No **Server-Authoritative Anti-Exploit** cooldown/distance validation on all combat remotes.  
   **Supposed to be:** Strict server-side sanity checks.
775. **Problem:** No **Combo Counter** UI during consecutive hits.  
   **Supposed to be:** Stylish combo tracker.
776. **Problem:** No **Weapon Trail VFX** during sword/dagger swings.  
   **Supposed to be:** Clean `Trail` attachment on weapons.
777. **Problem:** No **Parry Spark VFX** on successful guard.  
   **Supposed to be:** Crisp spark burst.
778. **Problem:** No **Arrow / Spell Hit Impact VFX**.  
   **Supposed to be:** Particle impact bursts.
779. **Problem:** No **Boss Death Dissolve / Victory Fanfare**.  
   **Supposed to be:** Dramatic defeat particles.
780. **Problem:** No **Loot Roll / Personal Loot** in party boss fights.  
   **Supposed to be:** Fair per-player drops.
781. **Problem:** No **Unique Weapon Evolution** (`Vorpal Chopper` upgrades).  
   **Supposed to be:** Multi-tier unique upgrades.
782. **Problem:** No **Inventory Filter / Sort** buttons.  
   **Supposed to be:** Sort by Type/Rarity/Power.
783. **Problem:** No **Gear Comparison Tooltip** (equipped vs hovered item).  
   **Supposed to be:** Side-by-side stat diff.
784. **Problem:** No **Quick-Equip** double-click support.  
   **Supposed to be:** One-click gear swapping.
785. **Problem:** No **Hotkey Rebinding** or Controller/Mobile touch buttons.  
   **Supposed to be:** Cross-platform input support.
786. **Problem:** No **Auto-Save (`DataStoreService`)** for stats, level, gear, discovered locations, and Colossi clears.  
   **Supposed to be:** Persistent player progression.
787. **Problem:** No **DataStore Error Handling / Retry** wrapper.  
   **Supposed to be:** Safe session-locking data save.
788. **Problem:** No **Server Shutdown (`BindToClose`)** save hook.  
   **Supposed to be:** Zero data loss on shutdown.
789. **Problem:** No **Starter Weapon** visually attached to player back/hand on spawn.  
   **Supposed to be:** Visible equipped weapon model.
790. **Problem:** No **Armor Visuals** on character.  
   **Supposed to be:** Visible equipped armor/cloak.
791. **Problem:** No **Sunraku-style Bird Mask / Cosmetic** unlockable in Rabituza/Fifticia.  
   **Supposed to be:** Iconic cosmetic masks/outfits.
792. **Problem:** No **Pencilgon / Oikatzo** style armor sets.  
   **Supposed to be:** Diverse Pioneer fashion.
793. **Problem:** No **Colossus Rematch Cooldown** timer.  
   **Supposed to be:** Fair rematch pacing.
794. **Problem:** No **Solo vs Party Difficulty Selector** for Gauntlet.  
   **Supposed to be:** Flexible challenge modes.
795. **Problem:** No **Combat Log** tab for inspecting damage math.  
   **Supposed to be:** Optional expandable combat log.
796. **Problem:** No **Monster Aggro Indicator** (`!` icon above mob head).  
   **Supposed to be:** Clear aggro alert.
797. **Problem:** No **Healing Number Popups** (green `+HP`).  
   **Supposed to be:** Clear heal feedback.
798. **Problem:** No **XP Bar** at bottom of screen showing level progress.  
   **Supposed to be:** Always-visible thin XP bar.
799. **Problem:** No **Level-Up Celebration VFX** (golden pillar of light).  
   **Supposed to be:** Level-up burst on character.
800. **Problem:** No **Automated Combat Unit Tests** in Studio.  
   **Supposed to be:** Reproducible combat verification script.

## 9. Stats, Hidden Stats, Jobs, Origins, Skills, Equipment & Economy (SLFConfig & SLFClient)

801. **Problem:** `SLFClient` Status tab lists 9 stats and 4 hidden stats, but **Hidden Stats (`Vorpal Soul`, `Karma`, `Trust`, `Mettle`) are canonically hidden (`隠しステータス`)**—should be obscured/mystical or unlocked via Appraisal.  
   **Supposed to be:** Canon mystery framing or Appraisal reveal.
802. **Problem:** `Origin` selection (`8` Origins) only changes spawn location (`Wanderer` -> Rampant Forest; others -> Firstia) without canon starting stat modifiers.  
   **Supposed to be:** Canon Origin starting stat bonuses & traits.
803. **Problem:** `Job` selection (`19` Jobs) does not grant distinct starting weapons or skill loadouts.  
   **Supposed to be:** Each starter Job spawns with its canon weapon and 2–3 starter skills.
804. **Problem:** No **Subclass (`サブ職業`)** slot alongside Main Job.  
   **Supposed to be:** Canon Main Job + Sub Job pairing.
805. **Problem:** No **Job Promotion UI** showing `Swordsman -> Sword Master -> Master Swordsman` and `Blacksmith -> Master Craftsman` paths.  
   **Supposed to be:** Interactive Job Tree viewer.
806. **Problem:** No **Hidden Job** (`Ancient Craftsman`, `Ninja`, `Revenger`) unlock tracker or mystery hints.  
   **Supposed to be:** Secret job clues in-world.
807. **Problem:** No **Skill Mastery / Skill Rank** leveling through repeated use.  
   **Supposed to be:** Skills grow stronger with usage.
808. **Problem:** No **Skill Fusion / Arcane Arts** unlocked by combining Main + Sub jobs.  
   **Supposed to be:** Canon skill synthesis.
809. **Problem:** No **Avatar Appearance Customization** hair/eyes/face/outfit presets beyond basic body colors in Character Creation Studio.  
   **Supposed to be:** Rich Pioneer appearance editor.
810. **Problem:** No **Origin Lore Preview** text card when hovering/selecting each of the 8 Origins.  
   **Supposed to be:** Lore description + bonus preview.
811. **Problem:** No **Job Lore & Weapon Affinity** preview card during character creation.  
   **Supposed to be:** Weapon type + playstyle preview.
812. **Problem:** No **Player Nameplate / Title Display** above character heads in-world.  
   **Supposed to be:** Overhead Pioneer name, Level, and Title.
813. **Problem:** No **Vorpal Soul** visual indicator (e.g. subtle crimson/vorpal glint) when threshold is reached.  
   **Supposed to be:** Status badge for Rabituza eligibility.
814. **Problem:** No **Karma** alignment color indicator on player nameplate (white -> grey -> red PKer).  
   **Supposed to be:** Canon Karma aura.
815. **Problem:** No **Trust** meter breakdown per city/faction.  
   **Supposed to be:** Regional reputation tracking.
816. **Problem:** No **Mettle** effect on NPC first-impression greetings.  
   **Supposed to be:** Dynamic NPC greeting lines.
817. **Problem:** No **Character Reset / Re-Creation** option from main menu.  
   **Supposed to be:** Safe character slot or reset option.
818. **Problem:** No **Multiple Character Slots** (`Slot 1–3`) or alt-build support.  
   **Supposed to be:** Multi-slot save support.
819. **Problem:** No **Inventory Tab** in `SLFClient` showing icons, quantities, and stats.  
   **Supposed to be:** Grid-based RPG inventory.
820. **Problem:** No **Equipment Tab** showing paper-doll slots (Weapon, Sub-Weapon, Head, Body, Legs, Accessory).  
   **Supposed to be:** Visual loadout screen.
821. **Problem:** No **Quest Log Tab** tracking Active, Completed, and Unique Scenarios.  
   **Supposed to be:** Organized quest journal.
822. **Problem:** No **Map Tab** showing the full Shangri-La Frontier Old Continent map with player pin.  
   **Supposed to be:** Interactive continent map.
823. **Problem:** No **Settings Tab** (Audio volume, Graphics/Particles toggle, Camera sensitivity, Keybinds).  
   **Supposed to be:** Full player settings.
824. **Problem:** No **Friends / Party Tab** in `SLFClient`.  
   **Supposed to be:** Social & party management.
825. **Problem:** No **Trade Request** UI between players.  
   **Supposed to be:** Safe two-player trade window.
826. **Problem:** No **Auction House / Bazaar** or player stall listing.  
   **Supposed to be:** Economy marketplace.
827. **Problem:** No **Blacksmith Upgrade UI** showing success rate, ore cost, and multiplier gain.  
   **Supposed to be:** Interactive forge menu.
828. **Problem:** No **Shop UI** with Buy/Sell tabs, item preview, and Mahney balance.  
   **Supposed to be:** Clean NPC merchant modal.
829. **Problem:** No **NPC Dialogue Box** with character portrait/name, branching choices (`Talk`, `Shop`, `Quest`, `Leave`).  
   **Supposed to be:** Rich RPG dialogue window instead of plain notifications.
830. **Problem:** `MarketItem` `ProximityPrompt`s have basic text without price/icon preview.  
   **Supposed to be:** Rich item inspection card.
831. **Problem:** No **Status Allocation `+1` / `+5` / `+10` bulk buttons** in Status UI.  
   **Supposed to be:** Convenient stat-spending controls.
832. **Problem:** No **Stat Cap / Soft Cap** warning tooltips.  
   **Supposed to be:** Clear scaling curves.
833. **Problem:** No **EXP Curve** table tuned across Levels 1–99+ in `SLFConfig`.  
   **Supposed to be:** Balanced RPG leveling curve.
834. **Problem:** No **Monster Level vs Player Level** EXP scaling (prevents Lv. 99 farming Lv. 1 wolves).  
   **Supposed to be:** Canon diminishing returns + Vorpal Soul decay warning.
835. **Problem:** No **Trash Game Hunter (`クソゲーハンター`)** easter-egg title/achievement.  
   **Supposed to be:** Fun canon achievement.
836. **Problem:** No **Colossus Clear Badges** on player profile card.  
   **Supposed to be:** 7 Colossus emblem slots.
837. **Problem:** No **Death / Durability Loss** warning popup.  
   **Supposed to be:** Clear risk-reward feedback.
838. **Problem:** No **Title Buffs** (e.g., `Honorary Rabituzan` boosting Vorpal affinity).  
   **Supposed to be:** Meaningful title perks.
839. **Problem:** No **Skill Cooldown & Resource Preview** in Skill Book.  
   **Supposed to be:** MP/STM cost and multiplier display.
840. **Problem:** No **Consumable Crafting / Alchemy** UI for Apothecary NPCs.  
   **Supposed to be:** Potion crafting.
841. **Problem:** No **Fishing / Mining / Herbalism** gathering skill level.  
   **Supposed to be:** Life-skill progression.
842. **Problem:** No **Currency Drops (`Mahney`)** from monsters and quests.  
   **Supposed to be:** Balanced economy inflow/outflow.
843. **Problem:** No **Inn Rest Confirmation** modal showing HP/MP/STM restore and cost.  
   **Supposed to be:** Clean innkeeper interaction.
844. **Problem:** No **Fast-Travel Map Pin** click-to-warp at Respawn Shrines.  
   **Supposed to be:** Intuitive shrine warp menu.
845. **Problem:** No **Region Banner** (`FIRSTIA — TOWN OF BEGINNINGS`) cooldown/debounce so rapid border crossing doesn't spam.  
   **Supposed to be:** Smooth banner debounce.
846. **Problem:** No **Region Banner** Japanese subtitle (`第一の街 ファスティア`) matching anime UI.  
   **Supposed to be:** Bilingual anime-faithful banner styling.
847. **Problem:** No **UI Sound Effects** (button hover, click, equip clink, coin jingle, quest complete).  
   **Supposed to be:** Crisp UI audio.
848. **Problem:** No **Responsive UI Scaling (`UIAspectRatioConstraint` / `UITextSizeConstraint`)** verified on 16:9, mobile, and ultrawide.  
   **Supposed to be:** Clean scaling across all screens.
849. **Problem:** No **Gamepad / Console Navigation** support (`GuiService` selection).  
   **Supposed to be:** Full controller support.
850. **Problem:** No **Mobile Virtual Controls** layout check (avoiding HUD overlap with jump/thumbstick).  
   **Supposed to be:** Mobile-friendly HUD.
851. **Problem:** No **Starter Help / Controls Guide (`H` key)**.  
   **Supposed to be:** Quick-reference keybind overlay.
852. **Problem:** No **Server-Side RemoteEvent Rate Limiting** on Stat/Shop/Gauntlet remotes.  
   **Supposed to be:** Anti-spam protection.
853. **Problem:** No **Client-Side Prediction** on dash/UI responsiveness.  
   **Supposed to be:** Snappy zero-lag UI feel.
854. **Problem:** No **Clean Error Toast** when trying to use a skill with insufficient MP/STM.  
   **Supposed to be:** Clear feedback banner.
855. **Problem:** No **Tooltip Delay & Screen-Edge Clamping** on item hovers.  
   **Supposed to be:** Polished hover tooltips.
856. **Problem:** No **Equipment Set Bonuses** (e.g., `Crystal Set`, `Vorpal Set`).  
   **Supposed to be:** 2-piece / 4-piece set perks.
857. **Problem:** No **Unique Item Lore Flavor Text** on gear cards.  
   **Supposed to be:** Canon item descriptions.
858. **Problem:** No **Vorpal Soul Collar** toggle/remove quest.  
   **Supposed to be:** Canon collar progression.
859. **Problem:** No **Player Inspect** prompt to view another Pioneer's title & gear.  
   **Supposed to be:** Social inspect menu.
860. **Problem:** No **Guild / Clan Creation** system.  
   **Supposed to be:** Pioneer clan tags & roster.
861. **Problem:** No **Clan Hall** teleport or shared storage.  
   **Supposed to be:** Clan progression feature.
862. **Problem:** No **Daily / Weekly Bounty** rotation.  
   **Supposed to be:** Replayable endgame goals.
863. **Problem:** No **Boss Rush / Rematch** mode in Rabituza Colosseum.  
   **Supposed to be:** Replayable gauntlet tiers.
864. **Problem:** No **Achievement Tracker** UI.  
   **Supposed to be:** Milestone checklist.
865. **Problem:** No **Screenshot / Photo Mode** hiding HUD (`P` key).  
   **Supposed to be:** Clean HUD toggle.
866. **Problem:** No **Colorblind / Accessibility** UI contrast options.  
   **Supposed to be:** Accessible high-contrast toggles.
867. **Problem:** No **Font Consistency** across `SLFClient` panels (mixed sizes/weights).  
   **Supposed to be:** Unified sleek RPG typography.
868. **Problem:** No **Animated Panel Transitions** (`TweenService` slide/fade).  
   **Supposed to be:** Polished UI motion.
869. **Problem:** No **Loading Screen** while terrain/world initializes.  
   **Supposed to be:** Themed SLF loading screen.
870. **Problem:** No **Intro Title Screen** (`SHANGRI-LA FRONTIER` -> `PLAY` / `CREATE PIONEER`).  
   **Supposed to be:** Immersive title flow.
871. **Problem:** No **Character Creation Skip** for returning players with saved data.  
   **Supposed to be:** Load existing Pioneer automatically.
872. **Problem:** No **Economy Sink** (fast-travel fees, repairs, high-tier potions, housing).  
   **Supposed to be:** Balanced Mahney sink.
873. **Problem:** No **Item Stack Splitting / Selling Bulk** in shop.  
   **Supposed to be:** Quality-of-life inventory controls.
874. **Problem:** No **Lock / Favorite Item** toggle preventing accidental sell.  
   **Supposed to be:** Item lock protection.
875. **Problem:** No **Quest Waypoint Beam / Compass Arrow** guiding to active quest objective.  
   **Supposed to be:** Optional objective tracker.
876. **Problem:** No **NPC Overhead Quest Icons** (`!` available, `?` turn-in).  
   **Supposed to be:** Classic RPG quest markers.
877. **Problem:** No **Mini-Map** corner widget showing roads and nearby NPCs.  
   **Supposed to be:** Toggleable corner minimap.
878. **Problem:** No **Notification History Log** in case a player misses a banner.  
   **Supposed to be:** Scrollable event log.
879. **Problem:** No **Ping / FPS / Server Region** optional debug readout.  
   **Supposed to be:** Diagnostic overlay toggle.
880. **Problem:** No **Version / Changelog** popup on join.  
   **Supposed to be:** Update notes panel.
881. **Problem:** No **Report / Feedback** button or admin command suite.  
   **Supposed to be:** Moderation/debug tools.
882. **Problem:** No **Localization** table (English + Japanese canon names toggle).  
   **Supposed to be:** EN/JP name display toggle.
883. **Problem:** No **Soundtrack Volume Slider** separate from SFX.  
   **Supposed to be:** Granular audio controls.
884. **Problem:** No **Camera FOV / Distance** slider.  
   **Supposed to be:** Custom camera comfort.
885. **Problem:** No **Auto-Run** toggle key.  
   **Supposed to be:** Long-distance travel convenience.
886. **Problem:** No **Emote Wheel** (Wave, Sit, Bow, Point).  
   **Supposed to be:** Social roleplay emotes.
887. **Problem:** No **Chat Bubbles** above NPCs and players.  
   **Supposed to be:** Styled RPG chat bubbles.
888. **Problem:** No **Trading Card / Pioneer Card** profile summary.  
   **Supposed to be:** Shareable Pioneer stats card.
889. **Problem:** No **Server-wide Event Timer** (Full Moon, Colossus Spawn).  
   **Supposed to be:** World clock HUD.
890. **Problem:** No **Moon Phase Indicator** on HUD (needed for Grotto secrets).  
   **Supposed to be:** Visible moon phase icon.
891. **Problem:** No **Weather Indicator** on HUD.  
   **Supposed to be:** Current biome weather readout.
892. **Problem:** No **Stamina/MP Numeric Overlay** (`120 / 120`) on bars.  
   **Supposed to be:** Exact numbers on resource bars.
893. **Problem:** No **HP Critical Red Vignette** when below 20% HP.  
   **Supposed to be:** Low-health visual cue.
894. **Problem:** No **Boss Stagger/Break Banner** feedback.  
   **Supposed to be:** Clear punish-window alert.
895. **Problem:** No **Gauntlet Timer & Round Reward Preview**.  
   **Supposed to be:** Clear colosseum UI.
896. **Problem:** No **Secret Area Counter** (`Hidden Areas: X/5`).  
   **Supposed to be:** Explorer milestone.
897. **Problem:** No **Bestiary Completion** reward.  
   **Supposed to be:** Scholar title unlock.
898. **Problem:** No **Crafting Mastery** bonus chance for high-rank crafts.  
   **Supposed to be:** Craft quality tiers (`Normal`, `Fine`, `Masterwork`).
899. **Problem:** No **Clean `SLFConfig` Type Annotations (`--!strict`)**.  
   **Supposed to be:** Strict Luau type-safety across all scripts.
900. **Problem:** No **Modular `ReplicatedStorage` Sub-modules** (one huge 18KB `SLFConfig`).  
   **Supposed to be:** Split into `Locations`, `Jobs`, `Items`, `Enemies`, `Colossi`.

## 10. Lighting, Visual Fidelity, Audio, Networking & Performance

901. **Problem:** `Lighting.Technology` is not explicitly verified/locked to `Future` (or `ShadowMap`) with calibrated `ShadowSoftness`.  
   **Supposed to be:** Crisp `Future` lighting with soft realistic shadows.
902. **Problem:** No **PBR `MaterialVariant`s** generated via `generate_material` applied across roads, roofs, and stone walls.  
   **Supposed to be:** Custom PBR cobblestone, slate shingle, plaster, and crystal materials.
903. **Problem:** No **Dynamic Biome Lighting Controller** shifting Atmosphere/ColorCorrection between surface, Ruluiath, Grotto, and Darkruin.  
   **Supposed to be:** Smooth client-side `TweenService` lighting transitions.
904. **Problem:** No **Water Caustics / Underwater Blur** when submerged or inside Ruluiath.  
   **Supposed to be:** Atmospheric underwater post-processing.
905. **Problem:** No **Day/Night Streetlamp & Window Toggle** (streetlamps glow at midday instead of brightening at dusk).  
   **Supposed to be:** Scripted dusk-to-dawn lamp & window illumination.
906. **Problem:** No **Shadow-Casting Optimization** (`CastShadow = false` on tiny decorative grass/leaves/particles).  
   **Supposed to be:** Smooth framerate without shadow-map waste.
907. **Problem:** No **Part/Triangle Budget Audit** across `Tpl_GreekRuins` (`3,373` parts) and `Tpl_MedievalHouseA` (`709` parts) clones.  
   **Supposed to be:** LOD / `StreamingEnabled` with `ModelStreamingMode = Persistent` for landmarks only.
908. **Problem:** `Workspace.StreamingEnabled = false` loads all `40,000+` parts simultaneously at join.  
   **Supposed to be:** Tuned `StreamingEnabled = true` with `StreamingMinRadius = 1200`, `StreamingTargetRadius = 2500`, and `Persistent` major landmarks.
909. **Problem:** Leftover `vfx pack` / `Particle Storage` / `Part` clutter (`80+` loose parts in root `Workspace`, seen at `22:02:59`).  
   **Supposed to be:** Cleanly moved into `ReplicatedStorage.VFX` or removed.
910. **Problem:** Root `Workspace.Script` (`Hello world!` printed twice on Play!) still exists.  
   **Supposed to be:** Removed leftover template `Hello world!` script.
911. **Problem:** Leftover `SpawnLocation` pad sitting unstyled in `Workspace`.  
   **Supposed to be:** Styled/hidden spawn pad inside Firstia / CharacterCreationStudio.
912. **Problem:** No **Collision Group (`PhysicsService`)** separating Player-to-Player, Player-to-NPC, and Weapon hitboxes.  
   **Supposed to be:** Clean collision groups preventing players blocking doorways.
913. **Problem:** No **Spatial Audio Zones** (`SoundGroup` for Music, SFX, Ambience).  
   **Supposed to be:** Structured `SoundService` hierarchy.
914. **Problem:** Zero **Sound Effects** wired to footsteps, sword swings, hits, portals, or UI.  
   **Supposed to be:** Full custom/library SFX suite.
915. **Problem:** Zero **Background Music** tracks across cities, wilds, and boss arenas.  
   **Supposed to be:** Curated looping RPG soundtrack.
916. **Problem:** No **Camera Collision / Smooth Follow** polish around tight city alleys and bridges.  
   **Supposed to be:** Clean camera clipping prevention.
917. **Problem:** No **Sky / Clouds (`Workspace.Terrain.Clouds`)** volumetric cloud layer.  
   **Supposed to be:** Dynamic volumetric `Clouds` drifting over mountain peaks.
918. **Problem:** No **DepthOfFieldEffect** subtle distant blur for cinematic scale.  
   **Supposed to be:** Light `DepthOfField` enhancing world depth.
919. **Problem:** No **SunRaysEffect** directional morning/evening god-rays through Rampant Forest canopy.  
   **Supposed to be:** Tuned forest god-rays.
920. **Problem:** No **Footstep Dust / Splash Particles** on dirt, snow, and shallow water.  
   **Supposed to be:** Surface-reactive footstep VFX.
921. **Problem:** No **Custom Loading & Asset Preload (`ContentProvider:PreloadAsync`)**.  
   **Supposed to be:** Smooth asset preloading on join.
922. **Problem:** No **Memory / Instance Leak Audit** on respawned mobs and temporary VFX.  
   **Supposed to be:** `Debris:AddItem` and proper connection cleanup.
923. **Problem:** No **Client Graphics Quality Toggle** (Disable Shadows / Reduce Particles for low-end devices).  
   **Supposed to be:** Performance mode toggle.
924. **Problem:** No **Server Tick / Heartbeat Budget** check for 150+ AI mobs.  
   **Supposed to be:** Distance-culled / throttled AI ticks.
925. **Problem:** No **Network Ownership** tuning on NPCs/projectiles.  
   **Supposed to be:** Smooth lag-free projectile replication.
926. **Problem:** `AssetTemplates` stored in `ServerStorage` includes unused/heavy raw parts without anchored/cancollide audit.  
   **Supposed to be:** Audited clean templates.
927. **Problem:** Multiple `BasePart`s inside `Tpl_MedievalHouse*` have unoptimized `CanTouch`/`CanQuery` enabled on every tiny trim piece.  
   **Supposed to be:** Disable `CanTouch`/`CanQuery` on non-interactive decorative trim.
928. **Problem:** No **Doorway Clearance Verification** on all walkable buildings.  
   **Supposed to be:** Verified R15/R6 character clearance.
929. **Problem:** No **Water Buoyancy / Swim Animation** polish in rivers and Fifticia harbor.  
   **Supposed to be:** Smooth swimming controls.
930. **Problem:** No **Night Sky Stars / Moon Texture** customized for Shangri-La Frontier.  
   **Supposed to be:** Crisp moon phase skybox.
931. **Problem:** No **Torch / Brazier Flicker** script on wall torches and forge embers.  
   **Supposed to be:** Subtle organic `PointLight` flicker.
932. **Problem:** No **BillboardGui `MaxDistance` Standardization** (some NPCs visible too far or popping abruptly).  
   **Supposed to be:** Uniform `MaxDistance = 60–80`.
933. **Problem:** No **ProximityPrompt `HoldDuration` & `Style` Standardization**.  
   **Supposed to be:** Consistent sleek prompt styling.
934. **Problem:** No **Character R15 / R6 Rig Standardization** check for animations and weapon grips.  
   **Supposed to be:** Consistent rig compatibility.
935. **Problem:** No **Tool / Weapon Grip Alignment** verification.  
   **Supposed to be:** Proper hand-grip CFrames for every weapon type.
936. **Problem:** No **Ragdoll / Dissolve** on enemy defeat.  
   **Supposed to be:** Clean fade-out instead of instant vanish.
937. **Problem:** No **Respawn Safe-Check** ensuring players never get stuck inside newly placed buildings.  
   **Supposed to be:** Spawn clearance raycast.
938. **Problem:** No **Automated Workspace Integrity Script** checking for floating parts (`ungrounded`), zero-size parts, or missing `PrimaryPart`.  
   **Supposed to be:** CI-style Studio integrity checker.
939. **Problem:** No **Rojo / Git Sync (`default.project.json`)** linking this Roblox place to the `Frontier-The-7-Colossi` GitHub repository.  
   **Supposed to be:** Full Rojo project export so Luau scripts and assets are version-controlled in Git.
940. **Problem:** No **Saved `.rbxl` Backup** inside `/Users/lin/Games/Frontier-The-7-Colossi/`.  
   **Supposed to be:** Exported `.rbxl` place file stored alongside the repo.
941. **Problem:** No **In-Game Bug Report / Coordinates Display** (`X, Y, Z`) for rapid QA.  
   **Supposed to be:** Toggleable coordinate readout.
942. **Problem:** No **Admin Teleport Command** (`/tp firstia`, `/tp ruluiath`, `/tp crystal`) for QA testing.  
   **Supposed to be:** Developer fast-jump commands.
943. **Problem:** No **Boss Reset Command** for testing Colossus phases cleanly.  
   **Supposed to be:** QA boss respawn command.
944. **Problem:** No **Client Error Telemetry** catching any runtime UI warnings.  
   **Supposed to be:** Clean error-free client log.
945. **Problem:** No **Server Startup Banner** logging loaded cities, NPCs, enemies, and Colossi counts.  
   **Supposed to be:** Clean diagnostic startup summary.
946. **Problem:** No **NPC Idle Animations** (breathing, looking, anvil hammering).  
   **Supposed to be:** Lively town NPCs.
947. **Problem:** No **Wildlife Ambient Creatures** (birds, butterflies in Hidden Garden, fish in Eighthold canal).  
   **Supposed to be:** `SLFWildlife` populated with animated critters.
948. **Problem:** No **Wind Sway** on banners, pennants, and tree leaves.  
   **Supposed to be:** Subtle environmental motion.
949. **Problem:** No **Underwater Sound Muffling (`EqualizerSoundEffect`)** in Ruluiath.  
   **Supposed to be:** Authentic underwater audio filter.
950. **Problem:** No **Cavern Echo (`ReverbSoundEffect`)** inside Prismatic Forest Grotto and Iron Ruin.  
   **Supposed to be:** Spatial cave reverb.
951. **Problem:** No **City Gate Bell / Guard Salute** on first entry.  
   **Supposed to be:** Immersive arrival feedback.
952. **Problem:** No **Dynamic Camera Zoom-Out** during giant Colossus fights (`Siegwurm`, `Ctarnidd`).  
   **Supposed to be:** Wider boss-fight FOV/camera distance.
953. **Problem:** No **Screen-Space Hit Flash** or **Parry Slow-Mo/Hitstop**.  
   **Supposed to be:** Punchy combat juice.
954. **Problem:** No **Consistent Color Grading** across `ColorCorrectionEffect` and `Atmosphere`.  
   **Supposed to be:** Cohesive anime-fantasy palette.
955. **Problem:** No **Sun Glare / Bloom Threshold** tuning so `Neon` runes glow without blowing out white floors.  
   **Supposed to be:** Balanced `Bloom.Threshold >= 1.2`.
956. **Problem:** No **Texture Compression / Mesh Triangle Budget** check on AI-generated meshes.  
   **Supposed to be:** All custom meshes kept under 20k triangles.
957. **Problem:** No **Duplicate `Model` Name Cleanup** inside `SLFWorld` (45+ identical `AncientRedwood_JumpingWoods` names).  
   **Supposed to be:** Unique indexed names across all folders.
958. **Problem:** No **Empty Folder Pruning** in `Workspace`.  
   **Supposed to be:** Zero unused empty containers.
959. **Problem:** No **Script Organization** (`ServerScriptService/Modules`, `ReplicatedStorage/Modules`, `StarterPlayerScripts/UI`).  
   **Supposed to be:** Clean modular script architecture.
960. **Problem:** No **Shared Constants / Enums Module** avoiding magic strings across server and client.  
   **Supposed to be:** Centralized `SLFEnums` module.
961. **Problem:** No **RemoteEvent / RemoteFunction Registry** avoiding scattered `Instance.new('RemoteEvent')` calls.  
   **Supposed to be:** Centralized `SLFRemotes` folder.
962. **Problem:** No **Graceful Fallback** if `AssetTemplates` or a custom mesh fails to load.  
   **Supposed to be:** Safe `WaitForChild` with timeout.
963. **Problem:** No **Anti-Stuck `/unstuck` Command** warping trapped players to the nearest road/shrine.  
   **Supposed to be:** Player safety command.
964. **Problem:** No **Server Hop / Matchmaking** stub for Colossi instances.  
   **Supposed to be:** Scalable instance architecture.
965. **Problem:** No **Character Accessory/Hat Clipping Check** with Vorpal Collar.  
   **Supposed to be:** Clean neck attachment offset.
966. **Problem:** No **Weapon Sheath Visual** on back/hip when out of combat.  
   **Supposed to be:** Visible sheathed weapons.
967. **Problem:** No **Dual-Blade Off-Hand Attachment** for Twin Blade User.  
   **Supposed to be:** Left + right hand weapon models.
968. **Problem:** No **Shield Attachment** on left arm for Knight.  
   **Supposed to be:** Visible shield model.
969. **Problem:** No **Magic Staff / Tome** floating/held animation for Mage jobs.  
   **Supposed to be:** Animated caster stance.
970. **Problem:** No **Arrow Quiver** on back for Magic Archer.  
   **Supposed to be:** Archer equipment detail.
971. **Problem:** No **Blacksmith Hammer** held prop for Craftsman jobs.  
   **Supposed to be:** Craftsman tool prop.
972. **Problem:** No **Shopkeeper Counter Collision** keeping players on the customer side cleanly.  
   **Supposed to be:** Proper shop counter spacing.
973. **Problem:** No **Inn Bed `ProximityPrompt`** animation/fade-to-black rest transition.  
   **Supposed to be:** Smooth rest fade.
974. **Problem:** No **Portal Fade Transition** when entering Rabituza, Ruluiath, or Inventoria.  
   **Supposed to be:** Smooth teleport fade instead of abrupt snap.
975. **Problem:** No **Boss Intro Title Card** (Japanese + English calligraphy) on Colossus aggro.  
   **Supposed to be:** Cinematic boss title overlay.
976. **Problem:** No **Death Respawn Fade** transition.  
   **Supposed to be:** Smooth respawn transition.
977. **Problem:** No **Consistent `Material` Usage** (replacing remaining `Plastic` / `SmoothPlastic` placeholders with `Slate`, `Brick`, `Wood`, `Cobblestone`, `Glass`).  
   **Supposed to be:** 100% textured PBR materials.
978. **Problem:** No **Cliffside Fog/Mist** below high bridges.  
   **Supposed to be:** Depth-enhancing valley mist.
979. **Problem:** No **Harbor Water Reflection** tuning at Fifticia.  
   **Supposed to be:** Crisp `WaterReflectance`.
980. **Problem:** No **Lighting `Ambient` / `OutdoorAmbient` Balance** so shadowed alleys aren't pitch black or washed out.  
   **Supposed to be:** Balanced cool shadows + warm bounce light.
981. **Problem:** No **PointLight `Range` & `Shadows` Audit** preventing overlapping light-flicker.  
   **Supposed to be:** Cleanly spaced light sources.
982. **Problem:** No **ParticleEmitter `Rate` Scaling** by graphics quality.  
   **Supposed to be:** Scalable VFX.
983. **Problem:** No **UI `ZIndex` Audit** ensuring modals never clip behind HUD bars.  
   **Supposed to be:** Clean UI layering.
984. **Problem:** No **Text Truncation / Overflow** check on long Japanese/English location names.  
   **Supposed to be:** Proper `TextScaled` / padding.
985. **Problem:** No **Memory Profiling** report after 10 minutes of Play mode.  
   **Supposed to be:** Zero memory growth.
986. **Problem:** No **Physics Sleeping / Anchoring Audit** ensuring static buildings are 100% `Anchored = true`.  
   **Supposed to be:** Zero unanchored building parts.
987. **Problem:** No **Weld / Motor6D Audit** on articulated enemies and bosses.  
   **Supposed to be:** Properly rigged enemy joints.
988. **Problem:** No **Tool/Weapon `CanCollide = false`** audit so swung weapons don't fling the player.  
   **Supposed to be:** Safe non-colliding weapon models.
989. **Problem:** No **NPC `Humanoid` vs Anchor Optimization** (using lightweight anchored/tweened NPCs unless animated).  
   **Supposed to be:** Low-overhead town NPCs.
990. **Problem:** No **Pathfinding NavMesh Verification** across city gates and bridges.  
   **Supposed to be:** 100% walkable gates and bridges.
991. **Problem:** No **Staircase Step-Height Audit** (ensuring R15 characters walk smoothly without jumping up palace/bridge stairs).  
   **Supposed to be:** Smooth wedge-ramp invis-colliders over steep stairs.
992. **Problem:** No **Water Depth Check** in shallow fountains/canals so players can wade or climb out easily.  
   **Supposed to be:** Proper canal ladder/stair exits.
993. **Problem:** No **Respawn Shrine Safe Radius** clear of any enemy aggro.  
   **Supposed to be:** Guaranteed safe spawn zones.
994. **Problem:** No **Server-to-Client Replication Budget** check for rapid combat.  
   **Supposed to be:** Batched/throttled visual FX remotes.
995. **Problem:** No **Clean `.gitignore`** excluding temp/backup files in the repo.  
   **Supposed to be:** Repo hygiene.
996. **Problem:** No **README Architecture & Map Guide** documenting all 32 locations and 7 Colossi in the repo.  
   **Supposed to be:** Clear developer documentation.
997. **Problem:** No **Automated Play-Mode Smoke Test** verifying spawn, character creation, combat, and gauntlet.  
   **Supposed to be:** Full end-to-end test.
998. **Problem:** No **Milestone Roadmap** linking these 1,000 issues to playable releases.  
   **Supposed to be:** Prioritized Phase 1–5 fix roadmap.
999. **Problem:** No **Cross-Server / ReservedServer** instancing for *Invitation from Rabituza* and *Ctarnidd* raids.  
   **Supposed to be:** Isolated per-party dungeon instances.
1000. **Problem:** No **Final QA Sign-off** confirming zero `Plastic` cube buildings and 100% canon `wikiwiki.jp/syanhuro/` parity.  
   **Supposed to be:** Production-ready Shangri-La Frontier experience.
