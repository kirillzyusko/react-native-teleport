import path from "node:path";
import ts from "typescript";

const root = path.resolve(__dirname, "../..");
const declarations = new Map<string, string>();

beforeAll(() => {
  const config = ts.readConfigFile(
    path.join(root, "tsconfig.build.json"),
    ts.sys.readFile,
  );
  const { options } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  );
  const program = ts.createProgram(
    [path.join(root, "src/index.ts"), path.join(root, "src/index.web.ts")],
    {
      ...options,
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: path.join(root, "lib/typescript"),
    },
  );
  program.emit(undefined, (file, text) => declarations.set(file, text));
});

function checkConsumer(source: string, native: boolean, legacy = false) {
  const file = path.join(root, "public-types-consumer.tsx");
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: legacy
      ? ts.ModuleResolutionKind.Node10
      : ts.ModuleResolutionKind.Bundler,
    customConditions: legacy ? undefined : native ? ["react-native"] : [],
    target: ts.ScriptTarget.ESNext,
    lib: native ? ["lib.esnext.d.ts"] : ["lib.esnext.d.ts", "lib.dom.d.ts"],
    types: ["react"],
  };
  const host = ts.createCompilerHost(options);
  const { readFile, fileExists, directoryExists } = host;
  const packageRoot = path.join(root, "node_modules/react-native-teleport");
  const packagePath = (name: string) =>
    name === packageRoot || name.startsWith(packageRoot + path.sep)
      ? path.join(root, path.relative(packageRoot, name))
      : name;
  const hidden = (name: string) =>
    !native &&
    /[/\\]node_modules[/\\](react-native|@react-native)([/\\]|$)/.test(name);

  host.readFile = (name) =>
    name === file
      ? source
      : hidden(name)
        ? undefined
        : (declarations.get(packagePath(name)) ?? readFile(packagePath(name)));
  host.fileExists = (name) =>
    name === file ||
    (!hidden(name) &&
      (declarations.has(packagePath(name)) || fileExists(packagePath(name))));
  host.directoryExists = (name) =>
    !hidden(name) &&
    ([...declarations.keys()].some((key) =>
      key.startsWith(packagePath(name) + path.sep),
    ) ||
      directoryExists?.(packagePath(name)) === true);
  host.getSourceFile = (name, version) => {
    const text = host.readFile(name);
    return text === undefined
      ? undefined
      : ts.createSourceFile(name, text, version);
  };

  const program = ts.createProgram([file], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}

it.each([false, true])(
  "checks web declarations without React Native or skipLibCheck (legacy: %s)",
  (legacy) => {
    expect(
      checkConsumer(
        `import { Portal, PortalHost, PortalProvider, usePortal } from "react-native-teleport";
         const portal = <Portal style={{ position: "fixed", padding: "1rem", transform: "translateX(10px)" }}>Hello</Portal>;
         const host = <PortalHost name="overlay" style={{ inset: 0 }} />;
         const provider = <PortalProvider>{portal}{host}</PortalProvider>;
         const hook = usePortal;
         // @ts-expect-error Invalid CSS value
         const invalid = <Portal style={{ position: "invalid" }} />;`,
        false,
        legacy,
      ),
    ).toEqual([]);
  },
);

it("preserves native styles with the react-native export condition", () => {
  expect(
    checkConsumer(
      `import { Portal, PortalHost } from "react-native-teleport";
       import { StyleSheet } from "react-native";
       const styles = StyleSheet.create({ view: { elevation: 3, transform: [{ translateX: 10 }] } });
       const portal = <Portal style={[styles.view, false, null, undefined, [{ opacity: 0.5 }]]} />;
       const host = <PortalHost name="overlay" style={styles.view} />;
       // @ts-expect-error CSS lengths are not native dimensions
       const invalid = <Portal style={{ padding: "1rem" }} />;`,
      true,
    ),
  ).toEqual([]);
});
