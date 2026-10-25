#!/usr/bin/env bash
# GH-545: decide which authors the agent may read. Reads GitHub logins (one per line) on stdin and
# prints a JSON array of the trusted ones: the repo owner, users whose repository permission is
# write/maintain/admin, and the Codex review bot. author_association is not enough (an org member or
# a read/triage collaborator is "MEMBER"/"COLLABORATOR" too), so the real permission is checked.
# Results are cached in $AGENT_RUN_DIR/trusted-logins.cache (one "login<TAB>yes|no" per line).
#
#   printf '%s\n' alice bob | trusted-logins.sh   ->   ["alice"]
set -euo pipefail

REPO="${REPO:?REPO}"
OWNER="${REPO%%/*}"
CACHE="${AGENT_RUN_DIR:-.agent-run}/trusted-logins.cache"
mkdir -p "$(dirname "${CACHE}")"
touch "${CACHE}"

trusted=()
while IFS= read -r login; do
  [[ -z "${login}" ]] && continue
  hit="$(awk -F'\t' -v l="${login}" '$1 == l {print $2; exit}' "${CACHE}")"
  if [[ -z "${hit}" ]]; then
    if [[ "${login,,}" == "${OWNER,,}" || "${login}" == "chatgpt-codex-connector[bot]" ]]; then
      hit=yes
    elif [[ "${login}" == *"[bot]" ]]; then
      hit=no
    else
      if ! perm="$(gh api "repos/${REPO}/collaborators/${login}/permission" --jq .permission 2>/dev/null)"; then
        # 404 = not a collaborator; anything else means we could not check -> treat as untrusted, say so.
        echo "::warning title=trusted logins::could not read the repository permission of ${login}; treated as untrusted" >&2
        perm=none
      fi
      case "${perm}" in admin|maintain|write) hit=yes ;; *) hit=no ;; esac
    fi
    printf '%s\t%s\n' "${login}" "${hit}" >> "${CACHE}"
  fi
  [[ "${hit}" == yes ]] && trusted+=("${login}")
done < <(sort -u)

if [[ ${#trusted[@]} -eq 0 ]]; then
  echo '[]'
else
  printf '%s\n' "${trusted[@]}" | jq -R . | jq -cs .
fi
