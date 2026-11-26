/**
 * Static (type-level) public API snapshot of workspace packages, produced with the
 * TypeScript compiler API. Complements the runtime export snapshot in capture.ts:
 * it records every exported name (values AND types), its kind, and its fully
 * expanded type text, so refactors cannot silently change a signature, a union
 * member, an optional property, or drop a type-only export.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const snapshotPackages = [
  "contracts", "scenario-engine", "evidence-core", "condition-adapters", "brief-core",
  "acquisition-hints", "planning-guidance", "narrative-references"
] as const;

const FORMAT = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

function kindOf(symbol: ts.Symbol): string {
  const f = symbol.flags;
  const kinds: string[] = [];
  if (f & ts.SymbolFlags.Interface) kinds.push("interface");
  if (f & ts.SymbolFlags.TypeAlias) kinds.push("type");
  if (f & ts.SymbolFlags.Class) kinds.push("class");
  if (f & ts.SymbolFlags.Function) kinds.push("function");
  if (f & ts.SymbolFlags.Variable) kinds.push("variable");
  if (f & ts.SymbolFlags.Enum) kinds.push("enum");
  return kinds.join("+") || `flags:${f}`;
}

function describe(checker: ts.TypeChecker, symbol: ts.Symbol, location: ts.Node): Record<string, unknown> {
  const out: Record<string, unknown> = { kind: kindOf(symbol) };
  if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class)) {
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    out.declared = checker.typeToString(declared, undefined, FORMAT);
    const props = (declared.flags & ts.TypeFlags.Object ? checker.getPropertiesOfType(declared) : []).map(prop => {
      const decl = prop.valueDeclaration ?? prop.declarations?.[0] ?? location;
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0 ? "?" : "";
      const readonly = (ts.getCombinedModifierFlags(decl as ts.Declaration) & ts.ModifierFlags.Readonly) !== 0 ? "readonly " : "";
      return `${readonly}${prop.name}${optional}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(prop, decl), undefined, FORMAT)}`;
    }).sort();
    if (props.length) out.members = props;
    const heritage = declared.isClassOrInterface() ? checker.getBaseTypes(declared).map(t => checker.typeToString(t)) : [];
    if (heritage.length) out.extends = heritage;
  }
  if (symbol.flags & (ts.SymbolFlags.Variable | ts.SymbolFlags.Function | ts.SymbolFlags.Class)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? location);
    out.type = checker.typeToString(type, undefined, FORMAT);
    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
    if (signatures.length) {
      out.signatures = signatures.map(sig => checker.signatureToString(sig, undefined, FORMAT | ts.TypeFormatFlags.WriteArrowStyleSignature));
    }
  }
  return out;
}

export function snapshotPackageApi(packageName: string): Record<string, unknown> {
  const dir = resolve(root, "packages", packageName);
  const configPath = resolve(dir, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dir);
  const entry = resolve(dir, "src/index.ts");
  const program = ts.createProgram([entry], parsed.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  if (!source) throw new Error(`cannot load ${entry}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error(`${entry} is not a module`);
  const result: Record<string, unknown> = {};
  for (const exported of checker.getExportsOfModule(moduleSymbol).sort((a, b) => a.name.localeCompare(b.name))) {
    const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    result[exported.name] = describe(checker, target, source);
  }
  return result;
}

export function buildApiSnapshot(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(snapshotPackages.map(name => [name, snapshotPackageApi(name)]));
}

export function renderApiSnapshot(snapshot: Record<string, Record<string, unknown>>): string {
  return JSON.stringify(snapshot, null, 1) + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2];
  if (!out) { console.error("usage: api-snapshot.ts <output-file>"); process.exit(2); }
  const { writeFileSync } = await import("node:fs");
  const snapshot = buildApiSnapshot();
  writeFileSync(out, renderApiSnapshot(snapshot));
  console.log(`wrote API snapshot: ${Object.entries(snapshot).map(([k, v]) => `${k}=${Object.keys(v).length}`).join(" ")}`);
}
