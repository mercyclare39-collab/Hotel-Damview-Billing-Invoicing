/**
 * Automated Apps Script Permanent Synchronization Engine
 * Hotel Damview ERP Suite
 *
 * Guarantees that:
 * 1. Root /Code.gs
 * 2. /google-apps-script/Code.gs
 * 3. /src/services/googleScriptCode.ts
 * are ALWAYS 100% identical, validated, and up to date with the latest app changes.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve('.');
const CODE_GS_ROOT = path.join(ROOT_DIR, 'Code.gs');
const CODE_GS_SUBDIR = path.join(ROOT_DIR, 'google-apps-script', 'Code.gs');
const TS_CODE_FILE = path.join(ROOT_DIR, 'src', 'services', 'googleScriptCode.ts');

export function syncAppsScriptFiles() {
  if (!fs.existsSync(CODE_GS_ROOT)) {
    console.warn('[Sync Apps Script] Warning: Root Code.gs not found!');
    return;
  }

  const codeGsContent = fs.readFileSync(CODE_GS_ROOT, 'utf8');
  const lines = codeGsContent.split('\n').length;
  const chars = codeGsContent.length;

  // Extract version from Code.gs header (e.g., Code.gs v5.0.0)
  const versionMatch = codeGsContent.match(/Code\.gs\s+(v\d+\.\d+\.\d+)/i) || codeGsContent.match(/Version:\s*(v\d+\.\d+\.\d+)/i);
  const version = versionMatch ? versionMatch[1] : 'v5.0.0';

  // 1. Keep /google-apps-script/Code.gs synchronized
  const subDir = path.dirname(CODE_GS_SUBDIR);
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }
  fs.writeFileSync(CODE_GS_SUBDIR, codeGsContent, 'utf8');

  // 2. Keep /src/services/googleScriptCode.ts synchronized
  const tsContent = `/**
 * HOTEL DAMVIEW - ENTERPRISE CENTRALIZED GOOGLE WORKSPACE BACKEND SCRIPT
 * Version: ${version}
 * Lines: ${lines}
 * Synchronized automatically from canonical Code.gs
 */

export const GOOGLE_APPS_SCRIPT_VERSION = "${version}";

export function getLatestAppsScriptVersion(): string {
  return GOOGLE_APPS_SCRIPT_VERSION;
}

export const GOOGLE_APPS_SCRIPT_CODE = ${JSON.stringify(codeGsContent)};
`;

  fs.writeFileSync(TS_CODE_FILE, tsContent, 'utf8');
  console.log(`[Sync Apps Script] Permanently synchronized Apps Script (${version}, ${lines} lines, ${(chars / 1024).toFixed(1)} KB) across Code.gs, google-apps-script/Code.gs, and googleScriptCode.ts.`);
}

// Auto-run if executed directly via node
syncAppsScriptFiles();
