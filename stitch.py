#!/usr/bin/env python3
"""Stitch one audio track and one picture or video clip into an mp4 music video.

From Python:

  from stitch import make_video
  make_video("song.mp3", "cover.png")                      # -> song.mp4
  make_video("song.mp3", "clip.mp4", output="out.mp4", fit="crop")

From the command line:

  stitch.py song.mp3 cover.jpg
  stitch.py song.mp3 clip.mp4 -o out.mp4 --aspect 16:9 --height 1080 --fps 60

The audio file sets the length of the result. An image is shown for the whole
song; a video shorter than the song is looped and a longer one is cut off.
Any sound inside a video file is discarded, so all audio comes from the audio
file. The result is 60 fps, and 4K (3840x2160) if the clip is 4K, else 1080p.
Needs ffmpeg and ffprobe, and tracktool.py in the same folder.
"""
import argparse
import sys
from pathlib import Path

from tracktool import TrackToolError, check_out, duration_of, require_ffmpeg, run

AUDIO_EXTS = {".mp3", ".flac", ".aac"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTS = {".mp4"}


def parse_aspect(value):
    """'16:9', '16/9', '9:16' or a number like 1.777 -> width/height ratio."""
    if isinstance(value, (int, float)):
        ratio = float(value)
    else:
        text = str(value).replace("/", ":")
        try:
            if ":" in text:
                w, h = text.split(":")
                ratio = float(w) / float(h)
            else:
                ratio = float(text)
        except (ValueError, ZeroDivisionError):
            raise TrackToolError(f"bad aspect ratio: {value!r}")
    if ratio <= 0:
        raise TrackToolError(f"bad aspect ratio: {value!r}")
    return ratio


def has_stream(path, kind):
    out = run(["ffprobe", "-v", "error", "-select_streams", kind[0],
               "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)])
    return bool(out.strip())


def video_size(path):
    """(width, height) of the first picture stream."""
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", str(path)])
    w, h = out.strip().split("x")
    return int(w), int(h)


def make_video(audio, visual, output=None, aspect="16:9", height=None, fps=60,
               fit="pad", force=False):
    """Combine `audio` (mp3, flac or aac) with `visual` (jpg, png or mp4).

    aspect  output shape, default "16:9" (width is worked out from `height`).
    height  output height in pixels. Default: 2160 (3840x2160) if `visual` is a
            4K video, otherwise 1080 (1920x1080), which includes all images.
    fps     frames per second of the result, default 60. A lower-fps clip gets
            frames repeated; it isn't made smoother.
    fit     what to do when the picture isn't the output shape: "pad" adds
            black bars (nothing is lost), "crop" fills the frame and trims the
            edges, "stretch" distorts the picture to fit.
    Returns the output path (default: <audio name>.mp4 next to the audio).
    """
    require_ffmpeg()
    audio, visual = Path(audio), Path(visual)
    for path in (audio, visual):
        if not path.is_file():
            raise TrackToolError(f"{path} not found")
    if audio.suffix.lower() not in AUDIO_EXTS:
        raise TrackToolError(f"audio must be one of {sorted(AUDIO_EXTS)}, got {audio.suffix!r}")
    is_image = visual.suffix.lower() in IMAGE_EXTS
    if not is_image and visual.suffix.lower() not in VIDEO_EXTS:
        raise TrackToolError(
            f"visual must be one of {sorted(IMAGE_EXTS | VIDEO_EXTS)}, got {visual.suffix!r}")
    if fit not in ("pad", "crop", "stretch"):
        raise TrackToolError(f"fit must be 'pad', 'crop' or 'stretch', got {fit!r}")
    if (height is not None and height < 2) or fps <= 0:
        raise TrackToolError("height and fps must be positive")
    if not has_stream(audio, "audio"):
        raise TrackToolError(f"{audio} has no audio")
    if not has_stream(visual, "video"):
        raise TrackToolError(f"{visual} has no picture")

    out = Path(output) if output else audio.with_suffix(".mp4")
    check_out(out, force)

    if height is None:
        height = 1080
        if not is_image:
            vw, vh = video_size(visual)
            if vw >= 3840 or vh >= 2160:
                height = 2160
    h = int(height) // 2 * 2  # h264 needs even dimensions
    w = max(2, round(h * parse_aspect(aspect) / 2) * 2)
    scale = {
        "pad": f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
               f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black",
        "crop": f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}",
        "stretch": f"scale={w}:{h}",
    }[fit]
    vf = f"{scale},setsar=1,fps={fps},format=yuv420p"

    seconds = duration_of(audio)
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if is_image:
        cmd += ["-loop", "1", "-framerate", f"{fps}"]
    else:
        cmd += ["-stream_loop", "-1"]  # repeat a short clip until the song ends
    cmd += ["-i", str(visual), "-i", str(audio),
            "-map", "0:v:0", "-map", "1:a:0",  # picture from the visual, sound only from the audio file
            "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-t", f"{seconds}", "-movflags", "+faststart", str(out)]
    run(cmd)
    print(f"{out} ({w}x{h}, {seconds:.2f}s)")
    return out


def main():
    parser = argparse.ArgumentParser(
        description="Stitch an audio file and a picture or video into an mp4.")
    parser.add_argument("audio", help="mp3, flac or aac")
    parser.add_argument("visual", help="jpg, png or mp4 (its sound is discarded)")
    parser.add_argument("-o", "--output", help="output path (default: <audio name>.mp4)")
    parser.add_argument("--aspect", default="16:9")
    parser.add_argument("--height", type=int, default=None,
                        help="default: 2160 for a 4K clip, else 1080")
    parser.add_argument("--fps", type=float, default=60)
    parser.add_argument("--fit", choices=["pad", "crop", "stretch"], default="pad")
    parser.add_argument("--force", action="store_true", help="overwrite output")
    args = parser.parse_args()
    try:
        make_video(args.audio, args.visual, args.output, args.aspect,
                   args.height, args.fps, args.fit, args.force)
    except TrackToolError as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main()
