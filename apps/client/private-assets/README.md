# Private models (personal use only)

Everything in this folder except this README is ignored by git, and only the local dev
server (`npm run dev`) serves it. `npm run build` and `npm run preview` never include these
files, so a build you publish cannot contain them.

## Adding a model

1. Download the model file (`.3mf` or `.stl`; `.glb`/`.gltf` also work).
2. From the repository root, convert it:

   ```bash
   npm run statue -w @frontier/asset-pipeline -- --input "/path/to/your/model.3mf" --name wukong
   ```

   This stands it upright, scales it to metres, and simplifies it into `wukong.glb` here.
   Turning it into the playable, animated Sun Wukong is the next step and builds on this file.

Options: `--yaw 90` (or 180, 270) if it faces the wrong way, `--height 3.4` in metres,
`--triangles 40000` for the detail budget. Re-run the command to replace it.

Keep these files out of commits and public builds: fan models of commercial characters and
most model-site licenses do not allow redistribution.
