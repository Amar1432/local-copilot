/**
 * Default Curated Multi-Language Benchmark Dataset
 */

import type { BenchmarkCase } from "../evaluation.types";

export const DEFAULT_BENCHMARK_DATASET: readonly BenchmarkCase[] = [
  // -------------------------------------------------------------------------
  // TypeScript / JavaScript
  // -------------------------------------------------------------------------
  {
    id: "ts-01-calc-sum",
    name: "TypeScript Array Sum",
    language: "typescript",
    category: "function_body",
    tags: ["math", "array", "typescript"],
    fullText: `export function calculateSum(numbers: number[]): number {\n  return numbers.reduce((acc, curr) => acc + curr, 0);\n}`,
    cursorLine: 1,
    cursorCharacter: 2,
    expectedCompletion: "return numbers.reduce((acc, curr) => acc + curr, 0);",
  },
  {
    id: "ts-02-filter-active",
    name: "TypeScript Filter Active Users",
    language: "typescript",
    category: "function_body",
    tags: ["filtering", "array", "typescript"],
    fullText: `interface User {\n  id: string;\n  name: string;\n  isActive: boolean;\n}\n\nexport function getActiveUsers(users: User[]): User[] {\n  return users.filter(u => u.isActive);\n}`,
    cursorLine: 7,
    cursorCharacter: 2,
    expectedCompletion: "return users.filter(u => u.isActive);",
  },
  {
    id: "ts-03-async-fetch",
    name: "TypeScript Async Fetch JSON",
    language: "typescript",
    category: "function_body",
    tags: ["async", "network", "typescript"],
    fullText: `export async function fetchJson<T>(url: string): Promise<T> {\n  const response = await fetch(url);\n  if (!response.ok) throw new Error(\`HTTP error \${response.status}\`);\n  return response.json() as Promise<T>;\n}`,
    cursorLine: 1,
    cursorCharacter: 2,
    expectedCompletion: "const response = await fetch(url);",
  },
  {
    id: "js-04-debounce",
    name: "JavaScript Debounce Helper",
    language: "javascript",
    category: "function_body",
    tags: ["utility", "javascript"],
    fullText: `function debounce(fn, delayMs) {\n  let timeoutId;\n  return (...args) => {\n    clearTimeout(timeoutId);\n    timeoutId = setTimeout(() => fn(...args), delayMs);\n  };\n}`,
    cursorLine: 2,
    cursorCharacter: 4,
    expectedCompletion: "clearTimeout(timeoutId);",
  },

  // -------------------------------------------------------------------------
  // Python
  // -------------------------------------------------------------------------
  {
    id: "py-01-fibonacci",
    name: "Python Fibonacci Generator",
    language: "python",
    category: "function_body",
    tags: ["math", "generator", "python"],
    fullText: `def fibonacci(n: int):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b`,
    cursorLine: 1,
    cursorCharacter: 4,
    expectedCompletion: "a, b = 0, 1",
  },
  {
    id: "py-02-dict-get-or-default",
    name: "Python Dict Frequency Counter",
    language: "python",
    category: "function_body",
    tags: ["collections", "dict", "python"],
    fullText: `def count_frequencies(items: list[str]) -> dict[str, int]:\n    counts = {}\n    for item in items:\n        counts[item] = counts.get(item, 0) + 1\n    return counts`,
    cursorLine: 3,
    cursorCharacter: 8,
    expectedCompletion: "counts[item] = counts.get(item, 0) + 1",
  },
  {
    id: "py-03-binary-search",
    name: "Python Binary Search",
    language: "python",
    category: "function_body",
    tags: ["algorithm", "search", "python"],
    fullText: `def binary_search(arr: list[int], target: int) -> int:\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1`,
    cursorLine: 1,
    cursorCharacter: 4,
    expectedCompletion: "left, right = 0, len(arr) - 1",
  },

  // -------------------------------------------------------------------------
  // Go
  // -------------------------------------------------------------------------
  {
    id: "go-01-error-check",
    name: "Go Error Check Pattern",
    language: "go",
    category: "control_flow",
    tags: ["idiom", "error_handling", "go"],
    fullText: `func readFile(path string) ([]byte, error) {\n\tdata, err := os.ReadFile(path)\n\tif err != nil {\n\t\treturn nil, fmt.Errorf("failed to read file: %w", err)\n\t}\n\treturn data, nil\n}`,
    cursorLine: 2,
    cursorCharacter: 1,
    expectedCompletion: "if err != nil {\n\t\treturn nil, fmt.Errorf(\"failed to read file: %w\", err)\n\t}",
  },
  {
    id: "go-02-string-contains",
    name: "Go String Contains in Slice",
    language: "go",
    category: "function_body",
    tags: ["slice", "utility", "go"],
    fullText: `func contains(slice []string, target string) bool {\n\tfor _, item := range slice {\n\t\tif item == target {\n\t\t\treturn true\n\t\t}\n\t}\n\treturn false\n}`,
    cursorLine: 1,
    cursorCharacter: 1,
    expectedCompletion: "for _, item := range slice {",
  },

  // -------------------------------------------------------------------------
  // Rust
  // -------------------------------------------------------------------------
  {
    id: "rs-01-result-map",
    name: "Rust Result Matcher",
    language: "rust",
    category: "control_flow",
    tags: ["error_handling", "match", "rust"],
    fullText: `pub fn parse_number(input: &str) -> Result<i32, ParseIntError> {\n    match input.trim().parse::<i32>() {\n        Ok(num) => Ok(num),\n        Err(err) => Err(err),\n    }\n}`,
    cursorLine: 1,
    cursorCharacter: 4,
    expectedCompletion: "match input.trim().parse::<i32>() {",
  },
  {
    id: "rs-02-struct-impl",
    name: "Rust Struct Constructor",
    language: "rust",
    category: "type_definition",
    tags: ["struct", "constructor", "rust"],
    fullText: `pub struct Buffer {\n    capacity: usize,\n    data: Vec<u8>,\n}\n\nimpl Buffer {\n    pub fn new(capacity: usize) -> Self {\n        Self {\n            capacity,\n            data: Vec::with_capacity(capacity),\n        }\n    }\n}`,
    cursorLine: 7,
    cursorCharacter: 8,
    expectedCompletion: "Self {\n            capacity,\n            data: Vec::with_capacity(capacity),\n        }",
  },

  // -------------------------------------------------------------------------
  // Java
  // -------------------------------------------------------------------------
  {
    id: "java-01-singleton",
    name: "Java Singleton Pattern",
    language: "java",
    category: "type_definition",
    tags: ["pattern", "singleton", "java"],
    fullText: `public class ConfigManager {\n    private static ConfigManager instance;\n    private ConfigManager() {}\n    public static synchronized ConfigManager getInstance() {\n        if (instance == null) {\n            instance = new ConfigManager();\n        }\n        return instance;\n    }\n}`,
    cursorLine: 4,
    cursorCharacter: 8,
    expectedCompletion: "if (instance == null) {\n            instance = new ConfigManager();\n        }",
  },
];
