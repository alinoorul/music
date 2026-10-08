# music
Music made by programs made by ALINOORUL

## tracktool.py

Cut and loop tracks (needs ffmpeg; Python 3 stdlib only).

From Python (put `tracktool.py` next to your script):

    from tracktool import cut, loop

    cut("song.wav", start="0:30", end="1:15")                  # -> song_cut.wav
    loop("song.wav", start="0:10", end="0:20", times=8,
         crossfade=0.5, output="loop.wav")                       # or duration="5:00"

Times are seconds or strings like `"1:15"`. Both return the output path, and
raise `tracktool.TrackToolError` on bad arguments or an ffmpeg failure. Pass
`force=True` to overwrite an existing output file.

From the command line:

    ./tracktool.py cut  song.wav --start 0:30 --end 1:15
    ./tracktool.py loop song.wav --start 0:10 --end 0:20 --times 8 --crossfade 0.5 -o loop.wav

For loops, `--crossfade` blends the end of the cut into its start so repeats
join without a click. Output `.wav` or `.flac`: lossy formats (mp3/aac) can add
a tiny gap at each repeat. Pick cut points on the beat for the best result.

## stitch.py

Make an mp4 music video from one audio file and one picture or video clip
(needs ffmpeg and `tracktool.py` in the same folder).

    from stitch import make_video

    make_video("song.mp3", "cover.png")                          # -> song.mp4
    make_video("song.mp3", "clip.mp4", output="out.mp4", fit="crop")

    ./stitch.py song.mp3 clip.mp4 -o out.mp4 --aspect 16:9 --height 1080

- Audio: mp3, flac or aac. Picture: jpg, png or mp4. All sound in the result
  comes from the audio file; any sound inside the mp4 clip is discarded.
- The audio sets the length. An image is held for the whole song; a clip
  shorter than the song loops, a longer one is cut off.
- Output is 16:9, 1080p, 30 fps, h264 + aac by default. If the picture isn't
  16:9, `fit="pad"` adds black bars (default), `"crop"` fills the frame and
  trims the edges, `"stretch"` distorts it.
