---
format: 1920x1080
duration: 84s
message: "Visually turns a browser design editor into a shared creative workspace where humans and agents build editable visuals together."
arc: Future Pacing + Demo Loop
audience: WebMCP Challenge judges and developers building agentic web experiences
mode: autonomous
music: none
---

## Video direction

- Palette: white canvas, near-black display type, muted violet body copy, and #7657FF as the single accent. Tinted violet cards, soft 10–14px corners, no content shadows. Cover and close may use restrained rings/dot atmosphere; product frames stay clean.
- Type: DM Sans display/body roles from frame.md. Headlines dominate at a 3:1 scale contrast; eyebrow chrome is uppercase violet; load-bearing copy stays above the legibility floor.
- Motion: smooth long-tail settles, VO-paced sequential reveals, and velocity-matched internal seams. Reveal each named idea on its spoken cue across the back half; no bounce. The final state of each shot holds still.
- Rhythm: Frames 1 and 3 carry the strongest reveal moves. Frames 2 and 6 organize breadth. Frame 4 is the calm confidence beat; Frame 7 holds the lockup for the closing read.
- Framing: the live product surface remains the dominant visual proof. Keep all essential UI and text in the top 83% to preserve the caption band.
- Never: off-brand gradients, generic AI particles, decorative stock imagery, fake customer logos, invented metrics, browser chrome, nav bars, lazy breathing, late camera drift, screensaver motion, or front-loaded slideshow animation.

## Frame 1 — The canvas can answer back

- scene: A close crop of the live design canvas pulls back into the full Visually workspace as the question lands.
- voiceover: "What if your design canvas could understand the job — and help finish it?"
- duration: 8s
- poster: 6s
- transition_in: cut
- status: animated
- src: compositions/frames/01-canvas-answers.html
- type: hook
- persuasion: Future pacing
- beat: curiosity
- blueprint: zoom-out-workspace-reveal (Adapt)
- asset_candidates: assets/visually-editor.png — full live Visually editor capture with editable poster on canvas
- focal: assets/visually-editor.png
- roles: visually-editor = background
- sfx: whoosh-short

narrativeRole: Open in outcome language and reveal that the canvas is an active workspace, not a passive image.
keyMessage: The editor can participate in the creative task.

Adapt: keep the single decelerating zoom-out signature; the close-up detail is the selected poster artwork and the containing whole is the real Visually workspace.
Scene 1 (0.0–2.5s): extreme close crop on the poster typography with all editor chrome outside frame; the first question phrase enters upper-left via per-word staggered reveal (`dynamic-content-sequencing`). Full-bleed macro, three depth layers from poster image, selection outline, and foreground type.
Scene 2 (2.5–5.8s): one continuous decelerating zoom-out (`viewport-change`) reveals the canvas, tool rail, template panel, and properties inspector in that order as the narration reaches “design canvas”; no second camera move.
Scene 3 (5.8–8.0s): camera locks on the full editor; a thin violet selection outline self-draws (`svg-path-draw`) and the payoff phrase “help finish it?” highlights on its spoken cue (`asr-keyword-glow`). Hold still.

## Frame 2 — Meet Visually

- scene: The live editor becomes a floating hero surface while the brand promise assembles beside it.
- voiceover: "Meet Visually: a browser-first design studio where people and agents create on the same editable canvas."
- duration: 10s
- poster: 7s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/02-meet-visually.html
- type: product_intro
- persuasion: Category creation
- beat: clarity
- blueprint: video-text-pivot (Adapt)
- asset_candidates: assets/visually-editor.png — full live Visually editor capture with templates, canvas, layers, and export chrome
- focal: assets/visually-editor.png
- roles: visually-editor = cutout
- sfx: click-soft

narrativeRole: Name the product and land the value promise by the second beat.
keyMessage: Visually is a shared creative surface for humans and agents.

Adapt: keep the show→yield→text weight-transfer signature; replace the unsupported hero statistic with the verified category promise.
Scene 1 (0.0–3.0s): a large floating crop of the real editor settles center-left, occupying roughly 62% of frame; the Visually eyebrow arrives alone above it. Asymmetric 60/40 with the UI as primary visual.
Scene 2 (3.0–6.4s): the editor slides left and scales down on a smooth long-tail move while “browser-first design studio” takes its vacated anchor via staggered type (`dynamic-content-sequencing`); the handoff reads as one event.
Scene 3 (6.4–8.6s): the category line clears to the phrase “people + agents” and a violet connector rule draws toward the still-visible canvas (`svg-path-draw`).
Scene 4 (8.6–10.0s): “same editable canvas” seals inside a single violet pill using scaleX and a trailing soft bloom (`ambient-glow-bloom`), then holds.

## Frame 3 — Ask, act, verify

- scene: A prompt types in, then a WebMCP action rail shows typed tools selecting a template, adding text, and inserting a shape before the editable canvas resolves.
- voiceover: "Ask for a launch graphic. WebMCP turns that intent into typed actions: choose a template, add copy, place a shape — with a receipt for every change."
- duration: 18s
- poster: 14s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/03-ask-act-verify.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: intrigue + control
- blueprint: compose
- asset_candidates: assets/visually-editor.png — real editor surface used as the result of the WebMCP action sequence
- focal: assets/visually-editor.png
- roles: visually-editor = background
- sfx: typing, click, pop

narrativeRole: Demonstrate the core WebMCP loop from natural-language intent to structured, inspectable canvas mutations.
keyMessage: WebMCP makes agent actions native, typed, and visible inside the product.

Compose: use a prompt→machine theater→progressive receipt structure; the answer is an editable Visually canvas plus a structured WebMCP action log.
Scene 1 (0.0–3.2s): the live editor sits dimmed at 42% behind a centered agent composer; “Create a bold launch graphic for a solar studio” types character-by-character with a visible caret (`discrete-text-sequence`, `context-sensitive-cursor`).
Scene 2 (3.2–5.0s): the violet submit control compresses and recovers (`press-release-spring`); the composer folds into a slim action rail as “WebMCP turns intent into typed actions” lands.
Scene 3 (5.0–8.8s): receipt row 01 arrives—`apply_template` with “Product Launch”—then checks off (`spring-pop-entrance`, `svg-path-draw`). The live editor brightens slightly and the template label is highlighted.
Scene 4 (8.8–12.2s): receipt row 02 arrives—`add_text` with “CHASE THE SUN”—and checks off; the canvas headline is outlined as the narration says “add copy.”
Scene 5 (12.2–15.0s): receipt row 03 arrives—`add_shape` with “sun / circle”—and checks off; a violet target ring marks the inserted element as the narration says “place a shape.”
Scene 6 (15.0–18.0s): the three receipts consolidate into a compact “3 actions applied” rail while the fully editable canvas occupies the right two-thirds; “receipt for every change” highlights and holds. Camera locked throughout machine theater.

## Frame 4 — Human judgment stays in the loop

- scene: The properties panel and canvas are shown as a coupled pair: typography, color, layers, and selection update together, then the mobile sidebar collapses cleanly.
- voiceover: "The agent accelerates the first draft. You keep the judgment — refining type, color, layers, and layout across portrait, landscape, square, and mobile."
- duration: 15s
- poster: 11s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-human-in-loop.html
- type: feature_showcase
- persuasion: Risk reversal
- beat: confidence + control
- blueprint: panel-edit-live-sync (Adapt)
- asset_candidates: assets/visually-editor.png — live editor interface with canvas and inspector visible
- focal: assets/visually-editor.png
- roles: visually-editor = background
- sfx: click-soft, whoosh-short

narrativeRole: Show that agent assistance does not remove human control and that the workspace adapts across formats.
keyMessage: Automation and direct manipulation coexist in one document.

Adapt: keep the live-sync couple signature; use reconstructed inspector controls over the real captured editor, then a responsive-format payoff.
Scene 1 (0.0–3.0s): split-screen crop holds the selected headline on the canvas at left and a crisp type inspector at right; selection chrome self-draws and the cursor lands on weight. Both surfaces remain co-visible.
Scene 2 (3.0–6.2s): the weight control scrubs 500→700 while the selected headline thickens in the same beat (`control-target-sync`); “You keep the judgment” lands as the couple settles.
Scene 3 (6.2–9.2s): the color swatch changes to violet and the canvas text mirrors instantly; the layers row reorders with one short drag (`cursor-drag`).
Scene 4 (9.2–12.2s): format pills arrive sequentially—Portrait, Landscape, Square—while the artboard reshapes by scale/translate proxies, never width/height tweens.
Scene 5 (12.2–15.0s): the stage resolves into a narrow mobile viewport; the sidebar snaps into a collapsed sheet and the canvas stays centered. Static final hold.

## Frame 5 — The browser is the production stack

- scene: Export formats assemble around the canvas while a local-processing rail connects rendering, media transforms, and upload progress.
- voiceover: "Rendering, image export, video processing, and project files stay browser-first. Even large uploads use clear progress, while your creative work remains portable."
- duration: 14s
- poster: 10s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/05-browser-production.html
- type: benefit_highlight
- persuasion: Friction reduction
- beat: trust
- blueprint: grid-card-assemble (Adapt)
- asset_candidates: assets/visually-editor.png — editor export surface and local-first status chrome
- focal: assets/visually-editor.png
- roles: visually-editor = background
- sfx: pop, chime

narrativeRole: Translate the client-side architecture into user benefit: speed, privacy, portability, and fewer server dependencies.
keyMessage: A capable production workflow can live in the browser.

Adapt: keep the staggered grid assembly signature; four browser-first production cards arrive around a persistent canvas crop instead of a generic feature wall.
Scene 1 (0.0–3.2s): the canvas crop anchors center-left; the eyebrow “THE BROWSER IS THE STACK” and first card “PNG · JPEG · SVG” arrive on the opening cue.
Scene 2 (3.2–6.0s): “Client-side rendering” and “Video via FFmpeg/WASM” cards slide a short distance directly into their slots (`center-outward-expansion`, short-path form), one per spoken phrase.
Scene 3 (6.0–9.6s): “Portable project JSON” joins; the four-card array holds in a restrained 2×2 grid while a violet flow line connects each card to the canvas.
Scene 4 (9.6–12.0s): a slim upload rail fills left-to-right (`stat-bars-and-fills`) under the label “Clear progress”; do not display a fabricated percentage.
Scene 5 (12.0–14.0s): the cards dim to reveal one centered line—“Your work stays portable.”—and the export confirmation check draws once. Hold.

## Frame 6 — Built for real creative range

- scene: A restrained card cascade presents the verified product breadth: templates, creative tools, typed WebMCP tools, responsive formats, and local persistence.
- voiceover: "Start from eighteen polished templates. Work with text, shapes, media, tables, drawing, effects, animation, and fourteen typed WebMCP tools — all in one focused studio."
- duration: 12s
- poster: 9s
- transition_in: squeeze
- status: animated
- src: compositions/frames/06-creative-range.html
- type: feature_showcase
- persuasion: Value stacking
- beat: power
- blueprint: grid-card-assemble (Reproduce)
- asset_candidates: assets/visually-editor.png — live editor capture proving the visible tool categories and template library
- focal: assets/visually-editor.png
- roles: visually-editor = background
- sfx: pop, ping

narrativeRole: Consolidate the breadth already evidenced on screen without turning the film into a feature list.
keyMessage: Visually has the range of a serious editor and an agent-native interaction layer.

Scene 1 (0.0–2.2s): a tight template-strip crop from the real editor anchors the left third; “18 polished templates” enters as the single dominant violet numeral and near-black label.
Scene 2 (2.2–7.8s): eight compact capability pills assemble directly into a 2×4 grid on the right—Text, Shapes, Media, Tables, Draw, Effects, Animation, Resize—each arriving on its spoken cue with short-path stagger (`center-outward-expansion`).
Scene 3 (7.8–10.2s): a ninth, wider violet-tint card arrives beneath the grid: “14 typed WebMCP tools”; its check outline self-draws (`svg-path-draw`) and becomes the focal item.
Scene 4 (10.2–12.0s): the array settles with no float; the phrase “one focused studio” wipes in above the persistent product crop and holds.

## Frame 7 — Design together

- scene: UI fragments clear outward, the Visually wordmark locks up, and the live URL lands inside the single violet CTA.
- voiceover: "Don’t make agents stop at the browser door. Design together — with Visually."
- duration: 7s
- poster: 5s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/07-design-together.html
- type: cta
- persuasion: Category challenge
- beat: motivation
- blueprint: logo-assemble-lockup (Adapt)
- asset_candidates:
- focal: Visually wordmark
- roles: wordmark = cutout
- sfx: whoosh-cinematic, impact-bass-1

narrativeRole: Close on the challenge thesis and a memorable, action-oriented brand line.
keyMessage: Agent-native creative work belongs inside the web product itself.

Adapt: keep the clear→assemble→held-lockup signature; build a typographic Visually mark from product UI fragments, then reveal the live URL without inventing a separate logo.
Scene 1 (0.0–2.0s): small editor-tool pills—Template, Text, Shape, Export—clear outward from a centered field (`center-outward-expansion` run outward) as “Don’t make agents stop at the browser door” lands.
Scene 2 (2.0–4.1s): a violet V-stroke self-draws (`svg-path-draw`); the remaining letters of “Visually” arrive left-to-right in one smooth cascade, followed by a thin underline sweep.
Scene 3 (4.1–5.4s): the lockup settles center; “Design together” wipes in beneath it while two faint concentric rings resolve behind the mark.
Scene 4 (5.4–7.0s): the live URL `visually.deeeplearn.com` reveals inside the single solid violet CTA pill. Everything holds dead still through the last frame.
