# WASM SIMD Build Guide

## Quick Build

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### Build Options

1. **From project root** (recommended):

   ```bash
   # Build WASM and copy to Chrome extension
   npm run build:wasm
   ```

2. **Build WASM package only**:

   ```bash
   # From packages/wasm-simd
   npm run build

   # Or from anywhere with pnpm filter
   pnpm --filter @chrome-mcp/wasm-simd build
   ```

3. **Dev build** (unoptimized, faster):
   ```bash
   npm run build:dev
   ```

### Build Output

After building, `pkg/` contains:

- `simd_math.js` — JavaScript bindings
- `simd_math_bg.wasm` — WebAssembly binary
- `simd_math.d.ts` — TypeScript types
- `package.json` — NPM package info

### Chrome Extension Integration

WASM files are automatically copied to `app/chrome-extension/workers/`. The extension uses them directly:

```typescript
const wasmUrl = chrome.runtime.getURL('workers/simd_math.js');
const wasmModule = await import(wasmUrl);
```

## Dev Workflow

1. Edit Rust code in `src/lib.rs`
2. Run `npm run build` to rebuild
3. Extension picks up the new WASM automatically

## Benchmarks

```bash
import { runSIMDBenchmark } from './utils/simd-benchmark';
await runSIMDBenchmark();
```
