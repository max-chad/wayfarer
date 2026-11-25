#!/usr/bin/env node
// A tiny mock of the Anthropic Messages API for exercising Wayfarer's Claude code paths offline.
// It is NOT a model: it returns schema-shaped sample JSON for structured outputs, and for tool-enabled
// streaming requests it first calls `search_places`, then answers with text once it sees the tool result.
//
//   node scripts/mock-anthropic.mjs            # listens on :4010
//   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:4010 npx tsx scripts/test-claude-paths.ts

import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4010);
let requests = 0;

function sample(schema, key = "", root = schema) {
  if (!schema) return null;
  if (schema.$ref) return sample(root.$defs?.[schema.$ref.split("/").pop()], key, root);
  if (schema.anyOf) return sample(schema.anyOf.find((s) => s.type !== "null") || schema.anyOf[0], key, root);
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case "object": {
      const o = {};
      for (const [k, v] of Object.entries(schema.properties || {})) o[k] = sample(v, k, root);
      return o;
    }
    case "array":
      return [sample(schema.items, key, root), sample(schema.items, key, root)];
    case "integer":
    case "number":
      return key === "day" ? 1 : key.toLowerCase().includes("id") ? 1 : 3;
    case "boolean":
      return true;
    case "string":
      if (key === "startTime") return "10:30";
      if (key === "kind") return "place";
      return `Mock ${key || "text"}`;
    default:
      return null;
  }
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || !req.url.startsWith("/v1/messages")) {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  requests++;
  const betas = req.headers["anthropic-beta"] || "";
  console.log(`#${requests} model=${body.model} stream=${!!body.stream} tools=${(body.tools || []).length} format=${!!body.output_config?.format} effort=${body.output_config?.effort} fallbacks=${JSON.stringify(body.fallbacks)} betas=${betas}`);

  const usage = { input_tokens: 1200, output_tokens: 180 };
  const base = { id: `msg_mock_${requests}`, type: "message", role: "assistant", model: body.model, stop_sequence: null };

  if (!body.stream) {
    const format = body.output_config?.format;
    const text = format ? JSON.stringify(sample(format.schema)) : "Mock answer: yes, it's great for families and books up fast in summer.";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...base, content: [{ type: "text", text }], stop_reason: "end_turn", usage }));
    return;
  }

  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const last = body.messages[body.messages.length - 1];
  const sawToolResult = Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result");
  sse(res, "message_start", { message: { ...base, content: [], stop_reason: null, usage: { input_tokens: 1200, output_tokens: 1 } } });
  if (body.tools?.length && !sawToolResult) {
    // thinking-style progress block, then a tool call streamed as input_json_delta fragments
    sse(res, "content_block_start", { index: 0, content_block: { type: "tool_use", id: "toolu_mock_1", name: "search_places", input: {} } });
    for (const frag of ['{"destination": "Par', 'is", "type": "restau', 'rant", "limit": 3}']) sse(res, "content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: frag } });
    sse(res, "content_block_stop", { index: 0 });
    sse(res, "message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 40 } });
  } else {
    const toolText = sawToolResult ? JSON.stringify(last.content[0].content).slice(0, 60) : "";
    sse(res, "content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    for (const w of ["Here are ", "three **great** picks ", "from the database. ", `(saw tool result: ${toolText ? "yes" : "no"})`]) {
      sse(res, "content_block_delta", { index: 0, delta: { type: "text_delta", text: w } });
      await new Promise((r) => setTimeout(r, 20));
    }
    sse(res, "content_block_stop", { index: 0 });
    sse(res, "message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 60 } });
  }
  sse(res, "message_stop", {});
  res.end();
});

server.listen(PORT, () => console.log(`Mock Anthropic API on http://localhost:${PORT}`));
