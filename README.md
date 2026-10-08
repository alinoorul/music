# music
Music made by programs made by Alinoorul

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
