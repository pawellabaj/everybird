// A `.wasm` file imported as a compiled WebAssembly.Module (`?module`): the Cloudflare build bundles it with the Worker.
declare module '*.wasm?module' {
  const compiled: WebAssembly.Module
  export default compiled
}
