#!/usr/bin/env bash
# Kill all dashdash dev processes and free ports 3000 + 4000

set -euo pipefail

echo "Killing processes on :3000 and :4000..."
fuser -k 3000/tcp 4000/tcp 2>/dev/null && echo "Done." || echo "Nothing was running."
