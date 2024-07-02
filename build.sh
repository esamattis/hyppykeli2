#!/bin/sh

set -eu

esbuild vendor-entries/preact.js --outdir=vendor --format=esm --minify --bundle
esbuild vendor-entries/{htm.js,preact-hooks.js,preact-signals.js} --outdir=vendor --format=esm --minify --bundle --external:preact
