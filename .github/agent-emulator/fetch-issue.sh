#!/usr/bin/env bash
# GH-545: write an issue (body + comments) into the agent task and download its images.
# Issue images in private repos live behind auth; the HTML rendering of the issue contains
# short-lived signed URLs (private-user-images.githubusercontent.com/...?jwt=...) that can be
# downloaded without a token. Runs in the workflow (GH_TOKEN set), not by the agent.
#
#   fetch-issue.sh <issue-number> <task-file>
set -euo pipefail

ISSUE="${1:?issue number}"
TASK="${2:?task file}"
REPO="${REPO:?REPO}"
OUT="$(dirname "${TASK}")/issue-images"
mkdir -p "${OUT}"

gh api "repos/${REPO}/issues/${ISSUE}" --jq '"## Issue #\(.number): \(.title)\n\n\(.body // "")"' >> "${TASK}"

comments="$(gh api --paginate "repos/${REPO}/issues/${ISSUE}/comments" \
  --jq '.[] | "### Comment by \(.user.login) (\(.created_at[:10]))\n\n\(.body)\n"')"
if [[ -n "${comments}" ]]; then
  printf '\n## Comments\n\n%s\n' "${comments}" >> "${TASK}"
fi

# Signed image URLs from the rendered HTML of the body and the human comments.
html="$(gh api -H "Accept: application/vnd.github.html+json" "repos/${REPO}/issues/${ISSUE}" --jq '.body_html // ""')"
html+="$(gh api --paginate -H "Accept: application/vnd.github.html+json" "repos/${REPO}/issues/${ISSUE}/comments" \
  --jq '.[] | .body_html // ""')"
mapfile -t urls < <(printf '%s' "${html}" | grep -oE '<img[^>]+src="[^"]+"' | sed -E 's/.*src="([^"]+)"/\1/' \
  | sed 's/&amp;/\&/g' | grep -E '^https://(private-user-images\.githubusercontent\.com|github\.com/user-attachments|user-images\.githubusercontent\.com)/' || true)

if [[ ${#urls[@]} -gt 0 ]] && ! command -v ffmpeg >/dev/null; then
  # bg-setup.sh may be installing packages at the same time: wait for the dpkg lock.
  sudo apt-get -o DPkg::Lock::Timeout=300 install -y -qq ffmpeg >/dev/null
fi

n=0
list=""
for url in "${urls[@]}"; do
  n=$((n + 1))
  raw="${OUT}/issue-image-${n}.raw"
  if ! curl -fsSL --max-time 60 -o "${raw}" "${url}"; then
    echo "::warning title=issue image::could not download image ${n} of issue #${ISSUE}"
    continue
  fi
  ext="$(file -b --mime-type "${raw}" | sed -E 's#image/(jpeg|jpg)#jpg#; s#image/png#png#; s#image/gif#gif#; s#image/webp#webp#')"
  [[ "${ext}" == */* ]] && ext="bin"
  f="${OUT}/issue-image-${n}.${ext}"
  mv "${raw}" "${f}"
  # Device screenshots are larger than the agent may open (>2000 px crashes the session), so
  # only small copies are listed; an image that cannot be resized is not offered at all.
  [[ "${ext}" == "bin" ]] && { echo "::warning title=issue image::image ${n} has an unknown format"; continue; }
  small="${OUT}/issue-image-${n}-small.png"
  if ! ffmpeg -loglevel error -y -i "${f}" \
      -vf "scale=w='min(800,iw)':h='min(1600,ih)':force_original_aspect_ratio=decrease" "${small}"; then
    echo "::warning title=issue image::could not resize image ${n}; not offered to the agent"
    continue
  fi
  f="${small}"
  list+="- \`${f#${GITHUB_WORKSPACE:-$PWD}/}\`"$'\n'
done

if [[ -n "${list}" ]]; then
  printf '\n## Images from the issue\n\nThe issue images were downloaded for you (the links in the text are not reachable). Open them with the Read tool:\n\n%s' "${list}" >> "${TASK}"
fi
echo "issue #${ISSUE}: ${n} image link(s), downloaded: $(printf '%s' "${list}" | grep -c . || true)"
