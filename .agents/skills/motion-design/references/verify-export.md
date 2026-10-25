# Verify and export

## Headed Chrome, offscreen

Run WebGL checks in headed Chrome on the real GPU. Headless Chromium renders WebGL through SwiftShader on the CPU, which burns the machine and makes frame timings meaningless.

- **Launcher.** If the repository has `scripts/lib/launch-chrome.mjs`, use its `launchPlacedChrome({ place: 'offscreen', channel: 'chrome' })`. Otherwise launch with `--window-position=-2400,-2400` plus `--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`.
- **Never minimize the window instead.** A minimized window drops `requestAnimationFrame` to 1 fps.
- **Placement is in the environment.** Honor `CHROME_PLACE` when it is set, and pass the placement to any subagent or Codex brief that opens a browser, since they don't inherit it.
- **Screenshots.** Save them where the machine's rules say (for example a screenshots drive), not in the repository.

## Stills and errors

[scripts/stills.mjs](../scripts/stills.mjs) opens a page, measures ms/frame while it plays, pauses it, seeks to each requested time in the order given, and screenshots `#stage` to `t<seconds to 3 decimals>.png`. It prints console errors and `pageerror`s. The page must expose `window.__anim = {seek, pause}`.

```bash
node .agents/skills/motion-design/scripts/stills.mjs <file-or-url> 2,10,17.5 <out-dir>
```

Take stills at one point inside every chapter, including mid-transition times. Check them for overlaps, orphaned words, colour that has saturated to white, and labels colliding with shapes. Then watch the piece play at 1x to judge pacing and easing.

## Checks that caught real bugs (MAIMCOIL trailer, 2026-09-29)

- **Seek robustness.** Render the same list of times twice, once in forward order and once in reverse, and byte-compare the PNGs. With stills.mjs, run it twice into two folders (`2,10,17.5` then `17.5,10,2`); the file names come from the time, so matching names pair up. Grain must be seeded from `t` for this to work. A stateless renderer should match byte for byte; an engine with phosphor-trail feedback only converges toward the same image while paused, so compare it with a small per-pixel tolerance. Any difference beyond that means state leaks from one frame into the next (an unreset field, a trail buffer, a cached uniform). Also compare a fresh load at time t against a seek back to t from the end of the film; this caught the end slate's vignette leaking into earlier shots (web-engine.md).
- **Colour fidelity.** Sample hue and saturation from stills at a few pixels on each brand-coloured element and compare them numerically with the brand or game hex. That puts a number on tone-mapping drift (orange to salmon, lime to khaki) that a glance at a still can talk itself out of.
- **Audit shot by shot, then the whole film.** For a multi-shot film, give each shot its own audit: a fresh reviewer with no build context, stills across the shot, and spot checks of the source against what the stills show. Then run one audit of the whole film against the acceptance list.
- **Lab a new look before retuning the film.** Put live sliders on the real renderer (the `lab` skill, when it exists), settle the look on one or two shots, then apply the values through the master constants.

## Loop checks: seam, empty hold and rest

Run these on any piece that loops: a looping MP4 or GIF, a hero loop, the UI loops in [ui-loops.md](ui-loops.md). A loop breaks in three places that a watch at 1x easily misses: the wrap from the last frame to the first, state that one cycle leaves behind, and stories that never quite return to the design. `CYCLE` is the loop length in seconds.

Capture the stills in two runs. stills.mjs renders the times in the order given, on one page, so the second run plays the stories before it reaches the hold:

```bash
node .agents/skills/motion-design/scripts/stills.mjs <file-or-url> 0 <out-dir>/fresh
node .agents/skills/motion-design/scripts/stills.mjs <file-or-url> 2.4,5,8,10.983,11.7,11.983 <out-dir>/cycle
```

The times above fit the 12 s cycle in ui-loops.md; take yours from the piece's own phases. Compare pairs with `cmp` for a stateless renderer, or with the small per-pixel tolerance from the seek check above for an engine with trail feedback.

- **Seam.** When the loop ends on a hold, the frame at `CYCLE - 1/fps` (11.983 here) equals the fresh frame at 0. A loop with no hold, such as a marquee, must move exactly one full period per cycle: cut a frame strip across the wrap and check that the step from the last frame to the first matches every other step.
- **Empty hold.** Every still taken during the hold (11.7, 11.983) equals the fresh frame at 0. A difference is a helper, typed text or mask that the fade-out left behind, or a field the stories wrote and the reset block missed (the vignette bug in web-engine.md). Compare against the fresh load, never against another frame of the same run: two frames of one run carry the same leak and match each other.
- **Rest.** The frame just before the fade-out (10.983) equals the frame where the intro has landed and no story has started (2.4). Both are the design at rest, so any difference is a story that did not come back. Turn accents and story helpers off for this pair (a `?still` or `accents: false` switch), since pulse rings and sheens run on their own period.
- **Export window.** A looping export encodes frames `f = 0` to `CYCLE * fps - 1` at `t = f / fps`. Including `t = CYCLE` repeats the first frame at the wrap, which shows as a stutter on every loop.

## In-page WebCodecs export (run end to end 2026-09-28)

When `render(t)` is a pure function of time and every layer, text included, is drawn into the WebGL canvas, export in the page itself. The CoreWise promo rendered 94 s at 1920x1080, 60 fps (5,640 frames) in 33 s; the file was H.264 High at about 15 Mbit/s, 178 MB.

1. Create a second canvas and renderer at the export resolution. The WebGL context needs `preserveDrawingBuffer: true` so `new VideoFrame(canvas, { timestamp, duration })` reads the finished frame.
2. Pick the first supported config from `avc1.640033`, `avc1.4d0033`, `avc1.640028`, `avc1.42003e` via `VideoEncoder.isConfigSupported`, with `avc: { format: 'avc' }`.
3. Mux with the MIT-licensed [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (`ArrayBufferTarget`, `fastStart: 'in-memory'`). Vendor the UMD build with its licence notice. mp4-muxer is now deprecated "in favor of Mediabunny" and gets no fixes; use [Mediabunny](https://github.com/Vanilagy/mediabunny) for new work. Its `CanvasSource` docs show no colour-space option, so check the output's colour tags with ffprobe.
4. For each frame: render at `t = f / fps`, encode with a keyframe every 2 s, close the VideoFrame, and wait for `dequeue` when `encodeQueueSize > 6`. Yield to the event loop every 30 frames so progress can paint.
5. Download through an anchor with `download`. From Playwright, capture it with `page.waitForEvent('download')` and `saveAs`; returning the bytes through `evaluate` is too large.
6. Browsers without WebCodecs need a clear error, not a silent failure. Wrap the export in `try/finally` so a thrown error still restores the live render loop.
7. Verify with `ffprobe`: codec, profile, dimensions, frame rate, frame count and duration.

## Delivery and encoding checks

**Presets** (platform docs, read 2026-09-29):

| Target | Spec |
|---|---|
| Steam ([Steamworks](https://partner.steamgames.com/doc/store/trailer)) | up to 1920x1080, 30 or 60 fps, H.264 and AAC preferred, 5,000+ Kbps (Valve's encoder preset is 20 Mbps with 192 Kbps AAC), 16:9, audio 44.1 or 48 kHz stereo |
| YouTube 1080p SDR ([YouTube Help](https://support.google.com/youtube/answer/1722171)) | 8 Mbps at 24 to 30 fps, 12 Mbps at 48 to 60 fps; H.264 High, closed GOP of half the frame rate, 2 B-frames, 4:2:0, BT.709, MP4 with fast start; AAC-LC 48 kHz 384 kbps. "Encode at the same rate the footage was recorded." |
| YouTube Shorts ([YouTube Help](https://support.google.com/youtube/answer/15424877)) | square or vertical, up to three minutes |

**Colour tags.** Tags change metadata, not pixels. Tag BT.709 primaries and matrix; for the transfer, `-color_trc iec61966-2-1` (sRGB) matches most reliably across Chrome and Safari, which reads a `bt709` transfer as about gamma 1.95 ([ASWF encoding guidelines](https://github.com/AcademySoftwareFoundation/EncodingGuidelines/blob/main/WebColorPreservation.md)). From PNGs, set the RGB-to-YUV matrix explicitly: `-vf "scale=out_color_matrix=bt709:out_range=tv"`. Measured 2026-09-29 with ffmpeg on `#FF7A1A` (255 122 26), decoding back with the BT.709 matrix: this chain returned 254 120 24; `colorspace=all=bt709:iall=bt709:itrc=srgb` returned 255 115 8, because it re-encodes to the BT.709 transfer curve, which an sRGB tag then misdescribes. Canva hit a different failure: the common `fast=1` colorspace recipe came out "brighter and weaker" ([Canva engineering](https://www.canva.dev/blog/engineering/a-journey-through-colour-space-with-ffmpeg/)). Confirm tags with `ffprobe -show_streams` and compare a brand-colour pixel before and after encoding.

**Chroma.** 4:2:0 halves colour resolution: saturated red text and 1 px coloured lines go soft while white text stays sharp ([OBS forum test](https://obsproject.com/forum/threads/color-quality-loss-due-to-chroma-subsampling.123738/)). YouTube delivers 4:2:0 regardless. Set coloured text and lines 2 px or thicker, and check a zoomed frame.

**Dark gradients and grain.** Encoders erase dither, and the bands return. For x264 try `-crf 16 -tune grain -aq-mode 3`, where aq-mode 3 is "Auto-variance AQ with bias to dark scenes" ([x264 man page](https://manpages.debian.org/testing/x264/x264.1.en.html)). Each 6 CRF steps roughly halves or doubles the file ([slhck](https://slhck.info/video/2017/02/24/crf-guide.html)). 10-bit x264 (High 10) is poorly supported by hardware decoders; use HEVC Main 10 or AV1 only for masters, not web delivery.

**Audio offset.** A Remotion MP4 had audio 42.7 ms late because an AAC stream went through ADTS and lost its 2048-sample encoder delay ([Remotion issue](https://github.com/remotion-dev/remotion/issues/11688)). Run `ffprobe -select_streams a:0 -show_packets` and check that the first packet carries `skip_samples`.

**Loudness.** Measure integrated LUFS and true peak before shipping (for example `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`). Targets are in [sound.md](sound.md).

**Caption contrast.** For each caption, find the brightest pixel under its box across its frames, composite the scrim over it, and require 4.5:1 (3:1 for large text).

**Flashing.** Run the final MP4 through a standards-based analyser (Harding FPA, with its Japanese option for trailers) and record the worst second. A homemade luminance script is only a smoke test. Limits are in [accessibility.md](accessibility.md).

**Eye trace at cuts.** Give each shot a focus point; at hard cuts, check that the outgoing and incoming focus points share a screen region ([camera-cut.md](camera-cut.md)).

## Reviewing motion from the export

An agent cannot watch a video, but it can read dense frame strips cut from one:

```bash
ffmpeg -v error -ss 30.5 -t 4 -i out.mp4 -vf "fps=6,scale=480:-1,tile=4x6" -frames:v 1 strip.png
```

Cut one strip per transition and one strip of the whole piece at 1 fps for pacing. Tile long runs of stills into contact sheets (a page of `<img>` tags screenshotted by the same headed browser), so a full-timeline review costs a few images instead of dozens.

## Frame-stepped PNG export (fallback)

Use this when captions are DOM text or the piece needs ordered trail state the in-page exporter cannot reproduce. It was designed but, as of 2026-09-28, not yet run end to end. Prove it on a short range before relying on it.

1. Add `renderAt(t, dtFrames)` next to `frame(t)`, which draws without the rAF loop.
2. Reset the trail buffer, then step `t` from 0 to TOTAL in increments of 1/60 s, calling `renderAt(t, 1)`. The trails need every frame in order, so never skip ahead.
3. After each frame, read the canvas with `canvas.toDataURL('image/png')` or `page.screenshot` of the stage, and write it out as `00001.png` and so on. The DOM captions are not in the WebGL canvas, so either screenshot the stage element or draw the captions into a 2D canvas layered on top.
4. Encode: `ffmpeg -framerate 60 -i %05d.png -vf "scale=out_color_matrix=bt709:out_range=tv" -c:v libx264 -pix_fmt yuv420p -crf 16 -color_primaries bt709 -colorspace bt709 -color_trc iec61966-2-1 -movflags +faststart out.mp4`. See the colour-tag notes above; measure a brand pixel, since ffmpeg builds disagree on the default RGB matrix.
5. Check the first and last seconds, one mid-morph frame, and the file size.
