#!/usr/bin/env bash
# Re-extracts the scroll sequence from a new export of the SAME plan-séquence (e.g. the 1080p version),
# keeping exactly the frames listed in sampling.json: same numbering (f_0001 … f_0248), same stop frames
# (27 / 82 / 134 / 213 / 245). Only the definition changes.
#
# Usage: tools/extract-frames.sh <video.mp4> <out-dir> [webp-quality=74] [max-width=1920]
# Needs ffmpeg + ffprobe + python3. Then upload out-dir/f_*.webp to the theme's /assets.
set -euo pipefail
VIDEO="${1:?usage: extract-frames.sh <video.mp4> <out-dir> [quality] [max-width]}"
OUT="${2:?usage: extract-frames.sh <video.mp4> <out-dir> [quality] [max-width]}"
QUALITY="${3:-74}"
MAX_WIDTH="${4:-1920}"
HERE="$(cd "$(dirname "$0")" && pwd)"

EXPECTED="$(python3 -c "import json;print(json.load(open('$HERE/sampling.json'))['source']['frames'])")"
ACTUAL="$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$VIDEO")"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "WARNING: $VIDEO has $ACTUAL frames, the original export had $EXPECTED: the kept frame numbers" >&2
  echo "         would not land on the same moments. Export the same cut at the same frame rate (30 fps)." >&2
  exit 1
fi

SELECT="$(python3 -c "import json;print('+'.join('eq(n\\\\,%d)' % i for i in json.load(open('$HERE/sampling.json'))['keep']))")"
mkdir -p "$OUT"
ffmpeg -v error -y -i "$VIDEO" -vf "select='$SELECT',scale='min(iw\,$MAX_WIDTH)':-2" -vsync vfr \
  -c:v libwebp -quality "$QUALITY" "$OUT/f_%04d.webp"
COUNT="$(ls "$OUT"/f_*.webp | wc -l | tr -d ' ')"
echo "$COUNT frames written to $OUT ($(du -sh "$OUT" | cut -f1)), quality $QUALITY, max width $MAX_WIDTH"
