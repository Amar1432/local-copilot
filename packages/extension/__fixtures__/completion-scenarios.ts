/**
 * Predefined completion scenarios for testing.
 *
 * Each scenario provides a document string, cursor position, and expected
 * context values so tests can share realistic input data.
 */

export interface CompletionScenario {
  readonly name: string;
  readonly language: string;
  readonly document: string;
  readonly cursorLine: number;
  readonly cursorCharacter: number;
  readonly expectedPrefix: string;
  readonly expectedSuffix: string;
}

/**
 * TypeScript function completion — cursor inside an empty function body.
 */
export const FUNCTION_BODY: CompletionScenario = {
  name: "TypeScript function body",
  language: "typescript",
  document: `function greet(name: string) {
  |
}`,
  cursorLine: 1,
  cursorCharacter: 2,
  expectedPrefix: "function greet(name: string) {\n",
  expectedSuffix: "\n}",
};

/**
 * TypeScript variable assignment — cursor after `=`.
 */
export const VARIABLE_ASSIGNMENT: CompletionScenario = {
  name: "TypeScript variable assignment",
  language: "typescript",
  document: `const result = |
`,
  cursorLine: 0,
  cursorCharacter: 16,
  expectedPrefix: "const result = ",
  expectedSuffix: "\n",
};

/**
 * JavaScript object property — cursor inside an object literal.
 */
export const OBJECT_PROPERTY: CompletionScenario = {
  name: "JavaScript object property",
  language: "javascript",
  document: `const config = {
  host: "localhost",
  |
};`,
  cursorLine: 2,
  cursorCharacter: 2,
  expectedPrefix: 'const config = {\n  host: "localhost",\n',
  expectedSuffix: "\n};",
};

/**
 * JSX return statement — cursor after `return (` in a React component.
 */
export const JSX_RETURN: CompletionScenario = {
  name: "JSX return statement",
  language: "typescriptreact",
  document: `function App() {
  return (
    |
  );
}`,
  cursorLine: 2,
  cursorCharacter: 4,
  expectedPrefix: "function App() {\n  return (\n",
  expectedSuffix: "\n  );\n}",
};

/**
 * Python function definition — cursor inside a Python function.
 */
export const PYTHON_FUNCTION: CompletionScenario = {
  name: "Python function body",
  language: "python",
  document: `def calculate_total(items):
    |
    return result`,
  cursorLine: 1,
  cursorCharacter: 4,
  expectedPrefix: "def calculate_total(items):\n",
  expectedSuffix: "\n    return result",
};

/**
 * Empty document — cursor at the very beginning.
 */
export const EMPTY_DOCUMENT: CompletionScenario = {
  name: "Empty document",
  language: "typescript",
  document: "|",
  cursorLine: 0,
  cursorCharacter: 0,
  expectedPrefix: "",
  expectedSuffix: "",
};

/**
 * Cursor inside a comment — should be skipped by the provider.
 */
export const INSIDE_COMMENT: CompletionScenario = {
  name: "Inside single-line comment",
  language: "typescript",
  document: `// TODO: |
const x = 1;`,
  cursorLine: 0,
  cursorCharacter: 9,
  expectedPrefix: "// TODO: ",
  expectedSuffix: "\nconst x = 1;",
};

/**
 * Cursor inside a string — should be skipped by the provider.
 */
export const INSIDE_STRING: CompletionScenario = {
  name: "Inside string literal",
  language: "typescript",
  document: `const msg = "hello |
world";`,
  cursorLine: 0,
  cursorCharacter: 18,
  expectedPrefix: 'const msg = "hello ',
  expectedSuffix: '\nworld";',
};

/**
 * All scenarios grouped by language for parametric tests.
 */
export const TYPESCRIPT_SCENARIOS = [FUNCTION_BODY, VARIABLE_ASSIGNMENT, EMPTY_DOCUMENT];
export const JAVASCRIPT_SCENARIOS = [OBJECT_PROPERTY];
export const JSX_SCENARIOS = [JSX_RETURN];
export const SKIPPED_SCENARIOS = [INSIDE_COMMENT, INSIDE_STRING];

/**
 * All scenarios.
 */
export const ALL_SCENARIOS = [
  ...TYPESCRIPT_SCENARIOS,
  ...JAVASCRIPT_SCENARIOS,
  ...JSX_SCENARIOS,
  ...SKIPPED_SCENARIOS,
  PYTHON_FUNCTION,
];
