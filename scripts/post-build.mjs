import { cpSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// ============================================================
// post-build.mjs — Cross-platform asset copying for standalone output.
// Works seamlessly on Windows, Linux, macOS, and Docker containers.
// ============================================================

const root = process.cwd()
const standaloneDir = join(root, ".next", "standalone")
const standaloneNextDir = join(standaloneDir, ".next")

const staticSrc = join(root, ".next", "static")
const staticDest = join(standaloneNextDir, "static")

const publicSrc = join(root, "public")
const publicDest = join(standaloneDir, "public")

if (existsSync(standaloneDir)) {
  if (existsSync(staticSrc)) {
    mkdirSync(standaloneNextDir, { recursive: true })
    cpSync(staticSrc, staticDest, { recursive: true, force: true })
  }
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDest, { recursive: true, force: true })
  }
}
