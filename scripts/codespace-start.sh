#!/usr/bin/env bash
# Starts the PAHE stack inside a Codespace / dev container. Waits for the Docker-in-Docker daemon,
# which starts a few seconds after the container does.
#   bash scripts/codespace-start.sh          build (if needed) and start
#   bash scripts/codespace-start.sh --check  only wait for Docker and validate the compose file
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Waiting for Docker..."
for i in $(seq 1 90); do
  if docker info >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 90 ]; then echo "Docker did not start within 3 minutes. Run 'Rebuild Container'." >&2; exit 1; fi
  sleep 2
done
docker compose version

bash scripts/setup-env.sh

if [ "${1:-}" = "--check" ]; then
  docker compose config --quiet && echo "Compose configuration is valid."
  exit 0
fi

docker compose up -d --build
echo
echo "PAHE is starting. Open the Ports tab and click the globe next to port 3000 (first start: a minute or two after this)."
