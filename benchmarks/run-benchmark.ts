#!/usr/bin/env node
/**
 * Standalone CLI runner for Local Copilot benchmarks.
 *
 * Usage:
 *   node --loader ts-node/esm benchmarks/run-benchmark.ts [--model <name>] [--endpoint <url>] [--lang <langs>]
 */

import { BenchmarkRunner, DEFAULT_BENCHMARK_DATASET, type CompletionExecutor } from "@local-copilot/core";

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.find((a, i) => args[i - 1] === "--model") || process.env.BENCHMARK_MODEL || "mock";
  const endpointArg = args.find((a, i) => args[i - 1] === "--endpoint") || process.env.BENCHMARK_ENDPOINT || "http://localhost:11434/v1";
  const langArg = args.find((a, i) => args[i - 1] === "--lang");

  console.log(`[Local Copilot] Starting evaluation benchmark...`);
  console.log(`[Local Copilot] Target Model: ${modelArg}`);
  console.log(`[Local Copilot] Endpoint: ${endpointArg}`);

  const runner = new BenchmarkRunner();

  // Mock / Live executor adapter
  const executor: CompletionExecutor = async (benchmarkCase) => {
    if (modelArg === "mock") {
      // Fast simulated completion for offline CI/testing
      const latencyMs = Math.floor(Math.random() * 40) + 15;
      return {
        completion: benchmarkCase.expectedCompletion ?? "",
        latencyMs,
      };
    }

    // Live endpoint HTTP request
    const startTime = Date.now();
    try {
      const res = await fetch(`${endpointArg}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelArg,
          messages: [{ role: "user", content: benchmarkCase.fullText }],
          max_tokens: 64,
          temperature: 0.1,
        }),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        throw new Error(`Endpoint returned status ${res.status}`);
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const completion = json.choices?.[0]?.message?.content || null;
      return { completion, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      throw err;
    }
  };

  const summary = await runner.run(DEFAULT_BENCHMARK_DATASET, executor, {
    filterLanguage: langArg ? langArg.split(",") : undefined,
    metadata: {
      model: modelArg,
      endpoint: endpointArg,
    },
  });

  const report = runner.formatMarkdownReport(summary);
  console.log("\n" + report);
}

main().catch((err) => {
  console.error("[Local Copilot Benchmark] Error:", err);
  process.exit(1);
});
