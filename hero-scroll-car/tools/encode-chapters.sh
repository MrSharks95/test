#!/usr/bin/env bash
# Usage: tools/encode-chapters.sh <plan-sequence-source.mp4> <out-dir> [target-MB=18.4]  (theme assets must stay < 20 MB)
# Web encodes for the chapters mode: forward (with audio) and reverse (silent), 1080p H.264,
# a keyframe every GOP frames (accurate seeks), +faststart, 2-pass to a target size.
# Env: GOP (default 15; 30 saves bitrate for long videos), PRESET (default slow; veryslow = better quality).
# A source larger than 1080p (e.g. a 4K export) is first scaled down to a near-lossless 1080p intermediate.
set -euo pipefail
SRC="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; OUT="$2"; TARGET_MB="${3:-18.4}"
GOP="${GOP:-15}"; PRESET="${PRESET:-slow}"
cd "$OUT"
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$SRC")
if [ "$W" -gt 1920 ]; then
  ffmpeg -loglevel error -y -i "$SRC" -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -preset veryfast -crf 8 -pix_fmt yuv420p -c:a copy src-1080.mp4
  SRC="$PWD/src-1080.mp4"
fi
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
VBR=$(python3 -c "print(int(($TARGET_MB*8*1024*1024/$DUR - 128000)/1000))")   # kbit/s for video, audio 128k
echo "duration $DUR s, video bitrate ${VBR}k, GOP $GOP, preset $PRESET"
X264="-c:v libx264 -preset $PRESET -profile:v high -pix_fmt yuv420p -g $GOP -keyint_min $GOP -sc_threshold 0 -b:v ${VBR}k -maxrate $((VBR*2))k -bufsize $((VBR*2))k"
# forward
ffmpeg -loglevel error -y -i "$SRC" -an $X264 -pass 1 -passlogfile fwd -f mp4 /dev/null
ffmpeg -loglevel error -y -i "$SRC" $X264 -pass 2 -passlogfile fwd -c:a aac -b:a 128k -movflags +faststart plan-sequence.mp4
# reverse, built in 90-frame chunks to keep memory low, then the chunks concatenated last-to-first
mkdir -p rev && rm -f rev/*
N=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$SRC")
i=0; k=0
while [ $i -lt $N ]; do
  e=$(( i + 90 < N ? i + 90 : N ))
  ffmpeg -loglevel error -y -i "$SRC" -an -vf "trim=start_frame=$i:end_frame=$e,setpts=PTS-STARTPTS,reverse" -c:v libx264 -preset veryfast -crf 8 -pix_fmt yuv420p rev/c_$(printf %03d $k).mp4
  i=$e; k=$((k+1))
done
ls rev/c_*.mp4 | sort -r | sed "s#^#file '$OUT/#; s#\$#'#" > rev/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i rev/list.txt -c copy rev/joined.mp4
ffmpeg -loglevel error -y -i rev/joined.mp4 -an $(echo $X264 | sed "s/-b:v ${VBR}k/-b:v $((VBR+128))k/") -pass 1 -passlogfile rev -f mp4 /dev/null
ffmpeg -loglevel error -y -i rev/joined.mp4 -an $(echo $X264 | sed "s/-b:v ${VBR}k/-b:v $((VBR+128))k/") -pass 2 -passlogfile rev -movflags +faststart plan-sequence-reverse.mp4
for f in plan-sequence.mp4 plan-sequence-reverse.mp4; do
  echo "$f $(stat -c %s $f) bytes, $(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames,r_frame_rate,width,height -of csv=p=0 $f)"
done
