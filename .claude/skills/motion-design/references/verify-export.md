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
node .claude/skills/motion-design/scripts/stills.mjs <file-or-url> 2,10,17.5 <out-dir>
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
node .claude/skills/motion-design/scripts/stills.mjs <file-or-url> 0 <out-dir>/fresh
node .claude/skills/motion-design/scripts/stills.mjs <file-or-url> 2.4,5,8,10.983,11.7,11.983 <out-dir>/cycle
```

The times above fit the 12 s cycle in ui-loops.md; take yours from the piece's own phases. Compare pairs with `cmp` for a stateless renderer, or with the small per-pixel tolerance from the seek check above for an engine with trail feedback.

- **Seam.** When the loop ends on a hold, the frame at `CYCLE - 1/fps` (11.983 here) equals the fresh frame at 0. A loop with no hold, such as a marquee, must move exactly one full period per cycle: cut a frame strip across the wrap and check that the step from the last frame to the first matches every other step.
- **Empty hold.** Every still taken during the hold (11.7, 11.983) equals the fresh frame at 0. A difference is a helper, typed text or mask that the fade-out left behind, or a field the stories wrote and the reset block missed (the vignette bug in web-engine.md). Compare against the fresh load, never against another frame of the same run: two frames of one run carry the same leak and match each other.
- **Rest.** The frame just before the fade-out (10.983) equals the frame where the intro has landed and no story has started (2.4). Both are the design at rest, so any difference is a story that did not come back. Turn accents and story helpers off for this pair (a `?still` or `accents: false` switch), since pulse rings and sheens run on their own period.
- **Export window.** A looping export encodes frames `f = 0` to `CYCLE * fps - 1` at `t = f / fps`. Including `t = CYCLE` repeats the first frame at the wrap, which shows as a stutter on every loop.

## In-page WebCodecs export (always; run end to end 2026-09-28 and 2026-10-19)

Every MP4 of a canvas animation is encoded in the page with WebCodecs. Never read back a PNG or screenshot per frame for ffmpeg to re-encode: the user called that "insanely inefficient" (user instruction, 2026-10-19). Draw every layer, text included, into the canvas so the encoder sees it. A piece built from DOM, CSS and several canvases goes through tab capture instead (next section). The CoreWise promo rendered 94 s at 1920x1080, 60 fps (5,640 frames) in 33 s; the file was H.264 High at about 15 Mbit/s, 178 MB.

**Driven from a script (Playwright), no muxer in the page.** Configure `avc: { format: 'annexb' }`, render and encode frames in batches of about 60 per `page.evaluate`, and return each batch's chunk bytes as a `Uint8Array`. Pipe them into `ffmpeg -f h264 -framerate 60 -i - -c:v copy -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1:video_full_range_flag=0 -movflags +faststart out.mp4`: a stream copy, with the colour tags written into the stream. Add audio in a second ffmpeg pass that copies the video. fullbuild.ai showreel 2 (2026-10-19, `scripts/export-showreel.mjs --encoder webcodecs`): `avc1.64002A` (High 4.2) at 40 Mbit/s variable, hardware encoder, 1080p60 at about 46 fps, colour patches within 0.6 levels of a lossless 4:2:0 conversion of the canvas.

1. Create a second canvas and renderer at the export resolution. The WebGL context needs `preserveDrawingBuffer: true` so `new VideoFrame(canvas, { timestamp, duration })` reads the finished frame.
2. Pick the first supported config from `avc1.640033`, `avc1.4d0033`, `avc1.640028`, `avc1.42003e` via `VideoEncoder.isConfigSupported`, with `avc: { format: 'avc' }`.
3. Mux with the MIT-licensed [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (`ArrayBufferTarget`, `fastStart: 'in-memory'`). Vendor the UMD build with its licence notice. mp4-muxer is now deprecated "in favor of Mediabunny" and gets no fixes; use [Mediabunny](https://github.com/Vanilagy/mediabunny) for new work. Its `CanvasSource` docs show no colour-space option, so check the output's colour tags with ffprobe.
4. For each frame: render at `t = f / fps`, encode with a keyframe every 2 s, close the VideoFrame, and wait for `dequeue` when `encodeQueueSize > 6`. Yield to the event loop every 30 frames so progress can paint.
5. Download through an anchor with `download`. From Playwright, capture it with `page.waitForEvent('download')` and `saveAs`; returning the bytes through `evaluate` is too large.
6. Browsers without WebCodecs need a clear error, not a silent failure. Wrap the export in `try/finally` so a thrown error still restores the live render loop.
7. Verify with `ffprobe`: codec, profile, dimensions, frame rate, frame count and duration.

## DOM + WebGL page export: tab capture into WebCodecs (run end to end 2026-10-27)

For a piece that is not one canvas (DOM text, CSS 3D, several WebGL canvases), capture the tab itself and feed its frames to `VideoEncoder`. The CORE+ free week piece went out this way at 1920x1080 and 1080x1920, 60 fps, 3,360 frames each, H.264 High 4.2 at about 38 Mbit/s, with every frame tied to its exact T. The scripts from that run are not shipped with this skill; the steps and commands below are the spec.

The piece must provide:

- `window.__anim = { seek, pause }` like stills.mjs, with `seek` taking seconds.
- Every frame a pure function of T. This route seeks once per frame, and a seek resets feedback such as the engine skeleton's phosphor trails. A piece with trail feedback draws its captions into the canvas and takes the in-page route above.
- Canvas backing stores at the full `devicePixelRatio`. A cap (the engine skeleton caps it at 1.5) renders below the capture scale, and the capture upscales it.

1. **Wrapper in a popup.** Launch headed Chrome offscreen with `--mute-audio --auto-accept-this-tab-capture` and open a page in `browser.newContext({ viewport: null })`, so Playwright emulates no viewport or DPR. From it, `window.open(url, 'cap', 'popup,width=..,height=..')` a wrapper page: an iframe holding the piece at OW x OH CSS px, and a marker strip to its right, outside the crop. Make the strip 16 to 20 CSS px wide so that its device width is an even integer (16 at 1.25 gives 20; 20 at 2 gives 40). It holds 16 stacked blocks, white for 1, carrying the index of the frame now shown. Size the window with CDP `Browser.setWindowBounds` until `innerWidth` is exactly OW plus the strip and `innerHeight` is exactly OH.
2. **HiDPI capture.** Bring the popup to the front and press one key (user activation), then call `getDisplayMedia({ video: { width: { max: W + S }, height: { max: H }, frameRate: 60 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' })`, with W x H the output size and S the strip width, all in device px. Max constraints larger than the CSS size make Chrome render the tab at a higher device scale, so the pixels are native, not upscaled: 1536x864 CSS at 1.25 gives 1920x1080; 540x960 at 2 gives 1080x1920. Re-fit the window (the sharing bar has appeared), check that `devicePixelRatio` equals the scale, and only then load the piece into the iframe so it boots at its final size.
3. **Frame-exact T.** Once the piece is ready, await `document.fonts.ready` and call `pause()`; then seek to the start, half a second in, and back to the start before frame 0, as the reference run did. Read frames with `MediaStreamTrackProcessor`. For frame i: seek to `i / fps` seconds (the CORE+ engine took milliseconds, `i * 1000 / fps`), wait three rAFs, set the marker to i, and take the first captured frame of coded size W + S by H whose marker reads i. Frames arrived as I420, so read the marker from plane 0 luma at the middle of each block (128 or more is 1; anything between 64 and 192 is ambiguous, so drop the frame). Close every other frame. If nothing arrives within 1.5 s, flip the marker away and back to force new damage, and retry.
4. **Encode.** Copy the output rect out of the captured frame with `copyTo`, close the captured frame, build a new `VideoFrame` from the buffer (same `format`, `layout` and `colorSpace`) with `timestamp: i * 1e6 / fps`, encode it, and close it: `avc: { format: 'annexb' }`, `prefer-hardware`, variable bitrate (40 Mbit/s here), keyframe every 2 s. Wait on `dequeue` while `encodeQueueSize > 4`. Every 60 frames, return the chunk bytes to Node as base64 and append them to an `.h264` file. After the last frame, `await encoder.flush()` and append what is left.

Capture pitfalls found on that run:

- **Window height clamp and sharing bar.** On a 1080-tall display Chrome clamps window height near 1100 physical px, and the tab strip, toolbar and the 56 px "sharing this tab" bar take 143 of it, so 960 CSS px never fit in a normal window. A popup window has no tab strip.
- **2x cap.** HiDPI capture scale tops out at 2x, so the CSS size must be at least half the output size.
- **Capture oracle ignores damage outside the animating region.** After about 20 seeks Chrome's capture locks onto the region that animates (the iframe) and stops delivering frames for damage elsewhere, so a marker-only change is never captured. Fix: every marker change also flips the iframe's opacity between 0.9999 and 0.9998. That damages the whole iframe without changing an 8-bit pixel. Never set it to 1, so the iframe keeps one compositing path.
- **Release capture buffers.** Copy the frame out of the capture buffer and close it at once. The encoder holds its input frames for a while, and capture stops delivering when its buffer pool runs dry.

**Mux**: a stream copy with exact 1/fps timestamps and colour tags in both the SPS and the container.

```bash
ffmpeg -v error -y -framerate 60 -i in.h264 -c:v copy -bsf:v "h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1:tick_rate=120,setts=ts=N*1000:duration=1000:time_base=1/60000" -video_track_timescale 60000 -color_primaries bt709 -color_trc iec61966-2-1 -colorspace bt709 -color_range tv -movflags +faststart out.mp4
```

Do not add `fixed_frame_rate_flag=1` to `h264_metadata`. On a stream whose SPS carries it as 0 (libx264, Media Foundation) ffmpeg stops with `low_delay_hrd_flag does not match inferred value`; `setts` and the track timescale already fix the timing. The transfer tag follows the colour-tag rule below (sRGB, 13). The CORE+ files shipped tagged BT.709 (1), the transfer Chrome's encoder reported; the patch check compares code values, so it cannot tell the two tags apart.

**Verify**:

- `ffprobe -count_frames`: codec, profile, level, `yuv420p`, colour tags, no B-frames, frame count equal to duration x fps.
- **Neighbour-T stills.** During the export, at a set of frame indices spread across every beat, screenshot the wrapper's crop at device scale for T, T minus one frame and T plus one frame. Decode the same frame from the MP4 (BT.709 limited to full-range RGB) and compare 8x8 patch means. Each frame must match its own T and beat both neighbours wherever the picture moves; an off-by-one frame matches a neighbour better. CORE+: 21 stills per layout, patch mean 0.55 to 1.14 levels, own T won in all 42.
- **Flash check.** Split each decoded frame into a 6x4 grid of relative luminance and fail any cell with more than 3 flashes in a 1 s window (a flash is a pair of opposing changes of 0.1 or more, the darker state below 0.8). Prove the detector first: it must fail a synthetic 5 Hz flash. It is a smoke test; the Harding note below still applies.
- Count black frames, capture retries and page errors (all 0 here), and cut a 1 fps contact sheet for a pacing review.

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

## Frame-stepped PNG export (last resort, owner's OK required)

Do not use this without the owner's explicit OK for that piece. A canvas piece goes through in-page WebCodecs; a DOM or multi-canvas piece goes through tab capture (both above). Ask only when neither can carry the piece, and say why.

1. Add `renderAt(t, dtFrames)` next to `frame(t)`, which draws without the rAF loop.
2. Reset the trail buffer, then step `t` from 0 to TOTAL in increments of 1/60 s, calling `renderAt(t, 1)`. The trails need every frame in order, so never skip ahead.
3. After each frame, read the canvas with `canvas.toDataURL('image/png')` or `page.screenshot` of the stage, and write it out as `00001.png` and so on. The DOM captions are not in the WebGL canvas, so either screenshot the stage element or draw the captions into a 2D canvas layered on top.
4. Encode: `ffmpeg -framerate 60 -i %05d.png -vf "scale=out_color_matrix=bt709:out_range=tv" -c:v libx264 -pix_fmt yuv420p -crf 16 -color_primaries bt709 -colorspace bt709 -color_trc iec61966-2-1 -movflags +faststart out.mp4`. See the colour-tag notes above; measure a brand pixel, since ffmpeg builds disagree on the default RGB matrix.
5. Check the first and last seconds, one mid-morph frame, and the file size.
