# Private models (personal use only)

Everything in this folder except this README is ignored by git, and only the local dev
server (`npm run dev`) serves it. `npm run build` and `npm run preview` never include these
files, so a build you publish cannot contain them.

## A custom character from a statue

Print models are one fused mesh with no skeleton. The character builder cuts the statue into
the rig's moving parts (torso and head, each arm, each leg, a held weapon), removes the base it
stands on, straightens the limbs into a standing pose, and scales it to the game:

```bash
npm run character -w @frontier/asset-pipeline -- --input "/path/to/hero.glb" --rig hero.rig.json --name hero
```

This writes `hero.rig.glb` here. In `npm run dev` the pause menu then shows a
"Custom character" toggle (off by default) to play as it.

The rig file holds the model's joint positions (shoulders, elbows, wrists, hips, knees, ankles,
sole heights and the weapon's two ends), measured from front and side renders. Its format is
`RigSpec` in `apps/asset-pipeline/src/character.ts`.

## A static statue or showpiece

```bash
npm run statue -w @frontier/asset-pipeline -- --input "/path/to/your/model.3mf" --name statue
```

This stands it upright, scales it to metres, and simplifies it into `statue.glb` here.
Options: `--yaw 90` (or 180, 270) if it faces the wrong way, `--height 3.4` in metres,
`--triangles 40000` for the detail budget. Re-run the command to replace it.
