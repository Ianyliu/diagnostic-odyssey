#!/usr/bin/env bash
# Run a command with outbound networking denied, to prove offline hermeticity.
#   scripts/verify/run-offline.sh npm test
# macOS: uses sandbox-exec. Linux: uses `unshare --net` (may require user namespaces or root).
# Package installation is also disabled for pip. This only restricts the child process.
set -euo pipefail
if [ "$#" -eq 0 ]; then echo "usage: $0 <command> [args...]" >&2; exit 2; fi
export PIP_NO_INDEX=1 PIP_CONFIG_FILE=/dev/null
case "$(uname -s)" in
  Darwin) exec sandbox-exec -p '(version 1)(allow default)(deny network*)' "$@" ;;
  Linux)  exec unshare --net --map-root-user "$@" ;;
  *) echo "unsupported platform: $(uname -s)" >&2; exit 2 ;;
esac
