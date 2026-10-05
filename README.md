# music
Music made by programs made by Alinoorul

## tracktool.py

Cut and loop tracks (needs ffmpeg; Python 3 stdlib only).

    ./tracktool.py cut  song.wav --start 0:30 --end 1:15
    ./tracktool.py loop song.wav --start 0:10 --end 0:20 --times 8 --crossfade 0.5 -o loop.wav

For loops, `--crossfade` blends the end of the cut into its start so repeats
join without a click. Output `.wav` or `.flac`: lossy formats (mp3/aac) can add
a tiny gap at each repeat. Pick cut points on the beat for the best result.
