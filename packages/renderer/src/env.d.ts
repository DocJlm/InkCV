// Minimal ambient declarations for the Node built-ins used by this package's
// scripts and tests. @types/node is intentionally NOT a dependency (the package
// targets the browser); only the handful of APIs we touch are declared here so
// `tsc --noEmit` stays green without pulling in the full Node typings.

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
}

declare module 'node:child_process' {
  export function execSync(
    command: string,
    options?: { cwd?: string; stdio?: 'inherit' | 'pipe' | 'ignore' | ReadonlyArray<unknown> },
  ): unknown;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
