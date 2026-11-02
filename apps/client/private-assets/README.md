# Private models (personal use only)

Everything in this folder except this README is ignored by git, and only the local dev
server (`npm run dev`) serves it. `npm run build` and `npm run preview` never include these
files, so a build you publish cannot contain them.

## A playable character from a statue (e.g. Sun Wukong)

Print models are one fused mesh with no skeleton. The character builder cuts the statue into
the rig's moving parts (torso and head, each arm, each leg, the weapon), removes the base it
stands on, straightens the limbs into a standing pose, and scales it to the game:

```bash
npm run character -w @frontier/asset-pipeline -- --input "/path/to/wukong.glb" --rig rigs/wukong.json --name wukong
```

This writes `wukong.rig.glb` here. Start `npm run dev` and the game wears it automatically
(and picks up the staff). The pause menu has a toggle to switch back to the default hunter.

`rigs/wukong.json` (in `apps/asset-pipeline`) holds the joint positions for that particular
model, measured from front/side renders. A different model needs its own rig file: copy it and
adjust the shoulders, elbows, wrists, hips, knees, ankles, sole heights and the weapon's two ends.

## A static statue or showpiece

```bash
npm run statue -w @frontier/asset-pipeline -- --input "/path/to/your/model.3mf" --name wukong
```

This stands it upright, scales it to metres, and simplifies it into `wukong.glb` here.
Options: `--yaw 90` (or 180, 270) if it faces the wrong way, `--height 3.4` in metres,
`--triangles 40000` for the detail budget. Re-run the command to replace it.
