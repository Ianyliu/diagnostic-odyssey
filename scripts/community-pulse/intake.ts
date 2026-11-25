import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { stderr, stdout } from "node:process";
import {
  createResearchIntakeState, ingestResearchDelivery, manualTransport, MAX_DELIVERY_BYTES,
  type ResearchIntakeState
} from "../../packages/community-pulse/src/transport.ts";
import { validateResearchReport } from "../../packages/community-pulse/src/research.ts";

const stateFile = "intake.json";
const maxStoreBytes = 4 * 1024 * 1024;

function hasCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function exists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (hasCode(error, "ENOENT")) return false;
    throw error;
  }
}

async function assertOutsideGit(path: string) {
  let current = path;
  while (true) {
    if (await exists(join(current, ".git"))) throw new Error("Choose a private intake directory outside any Git checkout.");
    if (dirname(current) === current) return;
    current = dirname(current);
  }
}

async function privateDirectory(input: string, allowCreate: boolean) {
  const target = resolve(input);
  const parent = await realpath(dirname(target));
  const path = join(parent, basename(target));
  await assertOutsideGit(path);
  if (allowCreate && !await exists(path)) await mkdir(path, { mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) {
    throw new Error("The state directory must have mode 0700 and cannot be a symlink.");
  }
  return path;
}

async function readBounded(path: string, max: number) {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    if (!(await file.stat()).isFile()) throw new Error("Expected a regular file.");
    const buffer = new Uint8Array(max + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesRead } = await file.read(buffer, offset, buffer.byteLength - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return buffer.subarray(0, offset);
  } finally {
    await file.close();
  }
}

async function loadState(directory: string): Promise<ResearchIntakeState> {
  try {
    const file = await readBounded(join(directory, stateFile), maxStoreBytes);
    if (file.byteLength > maxStoreBytes) throw new Error("Intake store exceeds its size limit.");
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file)) as ResearchIntakeState;
    if (data.version !== 1 || !Array.isArray(data.receipts) || !Array.isArray(data.candidates) ||
      data.candidates.some(candidate => !validateResearchReport(candidate.report).ok)) {
      throw new Error("Unreadable local intake state.");
    }
    return data;
  } catch (error) {
    if (hasCode(error, "ENOENT")) return createResearchIntakeState();
    throw error;
  }
}

function print(value: unknown) {
  stdout.write(JSON.stringify(value, null, 2) + "\n");
}

async function run(args: string[]) {
  const [command, first, second] = args;
  if (command === "list" && first && args.length === 2) {
    print((await loadState(await privateDirectory(first, false))).receipts);
    return;
  }
  if (command === "inspect" && first && second && args.length === 3) {
    const state = await loadState(await privateDirectory(second, false));
    const receipt = state.receipts.find(item => item.receiptId === first);
    if (!receipt) throw new Error("Receipt not found.");
    print({ receipt, report: state.candidates.find(item => item.receiptId === first)?.report ?? null });
    return;
  }
  if (command !== "import" || !first || !second || args.length !== 3) {
    throw new Error("Usage: intake.ts import <report.json|report.md> <private-directory>, list <private-directory>, or inspect <receipt-id> <private-directory>");
  }

  const format = extname(first).toLowerCase() === ".json" ? "json" : extname(first).toLowerCase() === ".md" ? "markdown" : null;
  if (!format) throw new Error("File extension must be .json or .md.");
  const directory = await privateDirectory(second, true);
  const raw = await readBounded(resolve(first), MAX_DELIVERY_BYTES);
  const lock = join(directory, ".import-lock");
  await mkdir(lock, { mode: 0o700 });
  const temporary = join(directory, ".intake-" + randomUUID());
  try {
    const result = ingestResearchDelivery(manualTransport.receive({ raw, format, operator: "local-operator" }),
      await loadState(directory));
    await writeFile(temporary, JSON.stringify(result.state) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, join(directory, stateFile));
    print(result.receipt);
    if (result.receipt.disposition === "quarantined") process.exitCode = 2;
  } finally {
    await unlink(temporary).catch(error => { if (!hasCode(error, "ENOENT")) throw error; });
    await rmdir(lock);
  }
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  stderr.write((error instanceof Error ? error.message : "Intake failed.") + "\n");
  process.exitCode = 1;
}
