#!/bin/bash
set -euo pipefail
[[ "$(uname)" = Darwin ]] || { echo 'Native helper must be compiled on macOS.' >&2; exit 1; }
mkdir -p native/bin
swiftc -O native/Metrics.swift -o native/bin/aether-arm64 -target arm64-apple-macosx12.0
swiftc -O native/Metrics.swift -o native/bin/aether-x64 -target x86_64-apple-macosx12.0
lipo -create native/bin/aether-arm64 native/bin/aether-x64 -output native/bin/aether-metrics
