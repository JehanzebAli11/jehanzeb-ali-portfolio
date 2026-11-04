# 3D portfolio experiment

Live at `/3d/` on this branch. The classic site at `/` is untouched.

## What is built: "Seven years, six islands"

A scroll-driven camera flight across floating low-poly islands, one per chapter of the classic site.
Plain Three.js (vendored in `vendor/`, no build step), every prop made from primitives, no model files.

| Chapter | Island | Interaction |
|---|---|---|
| 2017 Unreal at uni | Arcade cabinet cycling the six uni games, six game cards orbiting it | Click a card to open its YouTube video |
| 2020 Remio VR | Giant floating Quest-style headset, trees, a bouncing basketball, trailer screen | Screen plays `remio-house.mp4` |
| 2025 NFL on Roblox | Mini field with goalposts, a football looping end to end, a "400K+" sign | Screen plays `nfl-play.mp4` |
| TableSide | Cheesecake on a turntable, an amber scan ring and point cloud, a phone showing the AR view | Screen plays `ts-scan.mp4` |
| Valar | A firewall of bricks: white packets reach the model orb, red "secrets" bounce off and the wall flashes. DGX box beside it | Ambient demo of the product |
| Next | Pedestals: an atom (Ustaad), a lime (Lime), a 9x9 board that solves itself (Sudoku) | Click to boing |
| Hire | Camera pulls back over every island, with the CV buttons | |

Details:
- The camera rests at each stop while its card is read, then glides to the next one (`plateau()` in `main.js`).
- The mouse adds parallax. Clicking any prop squashes and stretches it and throws sparks. Screens and game cards open their project.
- Videos load and play only while their island is in view. Under reduced motion, nothing animates and posters stay still.
- The palette is the classic site's darkroom and amber, plus bloom on the glowing bits.
- On phones, the island sits in the top half and the card at the bottom.

## Other concepts worth trying next

1. **Your own game as the portfolio.** A small drivable or walkable world, steered with WASD or by touch, where projects are places you visit. It fits a game developer best. The cost: a physics library (Rapier or cannon-es) and more polish.
2. **Isometric "studio room".** One cosy diorama of your desk: a Quest headset, a DGX Spark, a Roblox figure and a monitor running the reel. Clicking each object zooms the camera onto it and opens that project. This is the most common Dribbble 3D portfolio look.
3. **TableSide-style AR card.** Use `<model-viewer>` with a real scanned dish from TableSide, rotatable on the page, with an "View in AR" button on phones. This proves the product right inside the portfolio.
4. **Clay / glass hero only.** Keep the classic site and swap just the hero for a soft clay-rendered 3D object (your initials, or a controller) that tilts with the cursor. Lowest effort, safest for recruiters.
5. **Showreel as a 3D gallery corridor.** Walk down a dark hallway with the footage hanging as lit frames. Scroll moves you forward.
6. **Particle morph.** One point cloud that morphs between shapes per chapter: a controller, a VR headset, a football, a cheesecake, a shield. Very striking and light on content.
7. **Valar as a mini game.** Drag packets yourself and watch the firewall redact them, turning the product demo into play.

## Running locally

```
python3 -m http.server 8000
# open http://localhost:8000/3d/
```
