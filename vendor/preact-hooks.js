// esbuild --external:preact ignores internal imports from preact/hooks so use this workaround
export * from "../node_modules/preact/hooks/dist/hooks.mjs";
