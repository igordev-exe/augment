import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const HOOK_RE = /^use[A-Z0-9]/;

function isComponentOrHookName(name: string | undefined): boolean {
  if (!name) return false;
  return /^[A-Z]/.test(name) || HOOK_RE.test(name);
}

interface LintIssue {
  file: string;
  line: number;
  rule: string;
  message: string;
}

function lintFile(filePath: string): LintIssue[] {
  const text = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const issues: LintIssue[] = [];
  const rel = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

  function report(node: ts.Node, rule: string, message: string) {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    issues.push({ file: rel, line: line + 1, rule, message });
  }

  function checkHookCallContext(node: ts.CallExpression) {
    let cur: ts.Node | undefined = node.parent;
    let conditionalOrLoop = false;
    while (cur && !ts.isSourceFile(cur)) {
      if (
        ts.isIfStatement(cur) ||
        ts.isForStatement(cur) ||
        ts.isForOfStatement(cur) ||
        ts.isForInStatement(cur) ||
        ts.isWhileStatement(cur) ||
        ts.isDoStatement(cur) ||
        ts.isConditionalExpression(cur) ||
        ts.isSwitchStatement(cur)
      ) {
        conditionalOrLoop = true;
      }
      if (
        ts.isBinaryExpression(cur) &&
        (cur.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || cur.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        conditionalOrLoop = true;
      }
      if (ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur)) {
        let fnName = ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) ? cur.name?.text : undefined;
        if (!fnName && cur.parent && ts.isVariableDeclaration(cur.parent) && ts.isIdentifier(cur.parent.name)) {
          fnName = cur.parent.name.text;
        }
        if (!isComponentOrHookName(fnName)) {
          report(node, "react-hooks/rules-of-hooks", `Hook chamado dentro de função auxiliar '${fnName ?? "anônima"}'.`);
        } else if (conditionalOrLoop) {
          report(node, "react-hooks/rules-of-hooks", `Hook chamado condicional ou dentro de loop em '${fnName}'.`);
        }
        return;
      }
      cur = cur.parent;
    }
    report(node, "react-hooks/rules-of-hooks", "Hook chamado no escopo global fora de componente ou hook.");
  }

  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      report(node, "@typescript-eslint/no-explicit-any", "Evite usar 'any' explícito; prefira 'unknown' ou tipos específicos.");
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const hookName = ts.isIdentifier(expr) ? expr.text : undefined;
      if (hookName && HOOK_RE.test(hookName)) {
        checkHookCallContext(node);
        if ((hookName === "useEffect" || hookName === "useMemo" || hookName === "useCallback") && node.arguments.length >= 2) {
          const deps = node.arguments[1];
          if (!ts.isArrayLiteralExpression(deps)) {
            report(deps, "react-hooks/exhaustive-deps", `O 2º argumento de ${hookName} deve ser um array literal de dependências.`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return issues;
}

const files = [...collectTsFiles("src"), ...collectTsFiles("scripts")];
const allIssues = files.flatMap(lintFile);

if (allIssues.length > 0) {
  for (const iss of allIssues) {
    console.error(`${iss.file}:${iss.line} [${iss.rule}] ${iss.message}`);
  }
  process.exit(1);
} else {
  console.log(`Lint OK (${files.length} arquivos verificados).`);
}
