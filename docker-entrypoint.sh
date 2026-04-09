#!/bin/sh
set -e
# Named volumes mount as root; app runs as `node`. Ensure upload dir is writable.
mkdir -p /var/pulse/uploads
chown -R node:node /var/pulse/uploads
exec su-exec node "$@"
