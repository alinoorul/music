#!/usr/bin/env python3
"""Cut and loop audio tracks using ffmpeg.

From Python:

  from tracktool import cut, loop
  cut("song.wav", start="0:30", end="1:15")
  loop("song.wav", start="0:10", end="0:20", times=8, crossfade=0.5, output="loop.wav")

From the command line:

  tracktool.py cut  song.mp3 --start 0:30 --end 1:15
  tracktool.py loop song.mp3 --start 0:10 --end 0:20 --times 8
  tracktool.py loop song.mp3 --start 0:10 --end 0:20 --duration 5:00 --crossfade 0.5

Times accept seconds (12.5), MM:SS (1:15) or HH:MM:SS (1:02:03).
Requires ffmpeg and ffprobe on PATH.
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
import wave
from array import array
from pathlib import Path


LOSSY = {".mp3", ".aac", ".m4a", ".ogg", ".opus"}


class TrackToolError(Exception):
    """Raised for bad arguments or a failed ffmpeg call."""


def parse_time(value):
    """Seconds as a number, or a string like '12.5', '1:15' or '1:02:03'."""
    if isinstance(value, (int, float)):
        seconds = float(value)
    else:
        parts = str(value).split(":")
        if len(parts) > 3:
            raise TrackToolError(f"bad time: {value!r}")
        try:
            seconds = 0.0
            for part in parts:
                seconds = seconds * 60 + float(part)
        except ValueError:
            raise TrackToolError(f"bad time: {value!r}")
    if seconds < 0:
        raise TrackToolError(f"time must be >= 0: {value!r}")
    return seconds


def require_ffmpeg():
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        raise TrackToolError("ffmpeg and ffprobe are required; install ffmpeg first")


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise TrackToolError(f"{cmd[0]} failed:\n{result.stderr.strip()}")
    return result.stdout


def duration_of(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(path)])
    return float(out.strip())


def resolve_range(src, start, end):
    if not src.is_file():
        raise TrackToolError(f"{src} not found")
    start = parse_time(start)
    total = duration_of(src)
    end = total if end is None else parse_time(end)
    if start >= end:
        raise TrackToolError(f"start ({start}s) must be before end ({end}s)")
    if start >= total:
        raise TrackToolError(f"start ({start}s) is past the end of the track ({total:.2f}s)")
    return start, min(end, total)


def default_out(src, suffix, out):
    return Path(out) if out else src.with_name(f"{src.stem}_{suffix}{src.suffix}")


def check_out(path, force):
    if path.exists() and not force:
        raise TrackToolError(f"{path} exists; pass force=True (--force) to overwrite")


def cut(input, start=0, end=None, output=None, force=False):
    """Keep only the part of `input` between `start` and `end`.

    Times are seconds or strings like "1:15". `end` defaults to the end of the
    track. Returns the output path (default: <name>_cut<ext> next to the input).
    """
    require_ffmpeg()
    src = Path(input)
    start, end = resolve_range(src, start, end)
    out = default_out(src, "cut", output)
    check_out(out, force)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
         "-ss", f"{start}", "-to", f"{end}", "-vn", str(out)])
    print(f"{out} ({end - start:.2f}s)")
    return out


def build_unit(seg_path, unit_path, fade):
    """Turn a segment into a unit that repeats seamlessly.

    The last `fade` seconds of the segment are blended into its first `fade`
    seconds, so the sample after the unit's end is the one that originally
    followed it. Repeating the unit then has no click or jump.
    """
    with wave.open(str(seg_path)) as w:
        ch, rate, frames = w.getnchannels(), w.getframerate(), w.getnframes()
        data = array("h", w.readframes(frames))
    n = int(round(fade * rate))
    if n == 0:
        unit = data
    else:
        head, tail = data[:n * ch], data[-n * ch:]
        mid = data[n * ch:-n * ch]
        mixed = array("h", bytes(len(head) * 2))
        for i in range(n):
            g = (i + 0.5) / n  # head fades in, tail fades out
            for c in range(ch):
                k = i * ch + c
                v = head[k] * g + tail[k] * (1 - g)
                mixed[k] = max(-32768, min(32767, int(round(v))))
        unit = mixed + mid
    with wave.open(str(unit_path), "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(unit.tobytes())
    return len(unit) // ch / rate


def loop(input, start=0, end=None, times=None, duration=None, crossfade=0.0,
         output=None, force=False):
    """Repeat the part of `input` between `start` and `end`, seamlessly.

    Give exactly one of `times` (number of repeats) or `duration` (approximate
    result length; rounded to a whole number of repeats). `crossfade` is the
    number of seconds blended across the loop point so the end flows into the
    start. Use .wav or .flac output for a gapless loop. Returns the output path.
    """
    require_ffmpeg()
    src = Path(input)
    start, end = resolve_range(src, start, end)
    seg_len = end - start
    fade = float(crossfade)
    if fade < 0 or fade * 2 >= seg_len:
        raise TrackToolError(f"crossfade must be >= 0 and under half the segment ({seg_len:.2f}s)")
    if (times is None) == (duration is None):
        raise TrackToolError("give exactly one of times or duration")
    if duration is not None:
        duration = parse_time(duration)

    out = default_out(src, "loop", output)
    check_out(out, force)
    if out.suffix.lower() in LOSSY:
        print(f"warning: {out.suffix} is lossy; encoder padding can leave a small gap "
              "at each repeat in sequential playback. Use .wav or .flac for a gapless loop.",
              file=sys.stderr)

    with tempfile.TemporaryDirectory() as tmp:
        seg, unit = Path(tmp) / "seg.wav", Path(tmp) / "unit.wav"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ss", f"{start}",
             "-to", f"{end}", "-vn", "-c:a", "pcm_s16le", str(seg)])
        unit_len = build_unit(seg, unit, fade)
        if times is not None:
            if times < 1:
                raise TrackToolError("times must be at least 1")
        else:
            times = max(1, round(duration / unit_len))
        run(["ffmpeg", "-y", "-v", "error", "-stream_loop", str(times - 1),
             "-i", str(unit), str(out)])
    print(f"{out} ({times * unit_len:.2f}s, {times} repeats of {unit_len:.3f}s)")
    return out


def main():
    def time_arg(text):
        try:
            return parse_time(text)
        except TrackToolError as e:
            raise argparse.ArgumentTypeError(str(e))

    parser = argparse.ArgumentParser(description="Cut and loop audio tracks.")
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p):
        p.add_argument("input")
        p.add_argument("--start", type=time_arg, default=0.0)
        p.add_argument("--end", type=time_arg, default=None,
                       help="default: end of track")
        p.add_argument("-o", "--output", help="output path (default: <name>_cut/_loop)")
        p.add_argument("--force", action="store_true", help="overwrite output")

    cut_p = sub.add_parser("cut", help="keep only the part between --start and --end")
    common(cut_p)

    loop_p = sub.add_parser("loop", help="repeat the part between --start and --end")
    common(loop_p)
    loop_p.add_argument("--times", type=int, help="number of repeats")
    loop_p.add_argument("--duration", type=time_arg,
                        help="approx. target length (rounded to a whole number of repeats)")
    loop_p.add_argument("--crossfade", type=float, default=0.0,
                        help="seconds blended across the loop point so the end flows into the start")

    args = parser.parse_args()
    try:
        if args.command == "cut":
            cut(args.input, args.start, args.end, args.output, args.force)
        else:
            loop(args.input, args.start, args.end, args.times, args.duration,
                 args.crossfade, args.output, args.force)
    except TrackToolError as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main()
