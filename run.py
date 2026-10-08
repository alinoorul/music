# from tracktool import cut, loop
from stitch import make_video

# CUT AND LOOP
# loop("./raw_music/obsolete.mp3", start="2:53", end="3:12", times=200, crossfade=0.5, output="./raw_music/obsolete_loop_3.mp3") 

# OBSOLETE LOOP
#loop("./raw_music/obsolete.mp3", start="2:53", end="3:12", times=5, crossfade=0.5, output="./raw_music/obsolete_loop_2.mp3")  

# STITCH
make_video("./raw_music/heyya_loop2.mp3", "./raw_video/heyya.mp4", output="./output/heyya.mp4", fit="crop")