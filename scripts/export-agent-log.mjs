// Exports a Claude Code session transcript into .agent-logs/ as a readable Markdown log.
// Content comes only from the transcript: every prompt, the agent's replies, and the tool
// calls it made. Internal system reminders and background-task notices are left out; tool
// outputs are not included (they can contain environment details).
//
// Usage: node scripts/export-agent-log.mjs <session.jsonl> [author]
// Claude Code stores sessions in ~/.claude/projects/<project>/<session-id>.jsonl.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const [file, author = "ZayanAhmed07"] = process.argv.slice(2);
if (!file) throw new Error("Pass the session .jsonl path.");
const records = readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const sessionId = records.find((record) => record.sessionId)?.sessionId ?? path.basename(file, ".jsonl");
const short = sessionId.slice(0, 8);

const stripReminders = (text) => text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
const cleanPrompt = (content) => {
  if (typeof content === "string") return stripReminders(content);
  return content.map((block) => (block.type === "text" ? stripReminders(block.text) : block.type === "image" ? "_[screenshot attached]_" : "")).filter(Boolean).join("\n\n");
};
const isSystemNotice = (text) => /^<task-notification>/.test(text.trim());

function describeTool(tool) {
  const input = tool.input ?? {};
  const rel = (value) => String(value ?? "").replace(/^.*?[\\/]8x[\\/]/i, "").replace(/\\/g, "/");
  switch (tool.name) {
    case "Bash": case "PowerShell": return `${tool.name}: ${input.description ?? String(input.command ?? "").split("\n")[0].slice(0, 100)}`;
    case "Write": return `Write \`${rel(input.file_path)}\``;
    case "Edit": return `Edit \`${rel(input.file_path)}\``;
    case "Read": return `Read \`${rel(input.file_path)}\``;
    case "ToolSearch": return "Load tool";
    case "Grep": return `Search for \`${String(input.pattern).slice(0, 60)}\``;
    default: {
      const name = tool.name.replace(/^mcp__Claude_Browser__/, "Browser: ").replace(/^mcp__ccd_session__mark_chapter$/, "Chapter marker").replace(/^mcp__[^_]+__/, "");
      const detail = input.url ?? input.action ?? input.preset ?? input.title ?? "";
      return detail ? `${name} (${String(detail).slice(0, 80)})` : name;
    }
  }
}

// Build exchanges: a prompt, then everything the agent said and did until the next prompt.
const exchanges = [];
let current = null;
for (const record of records) {
  const userText = record.type === "user" && !record.isMeta && (typeof record.message?.content === "string" || record.message?.content?.some?.((block) => block.type === "text" || block.type === "image")) ? cleanPrompt(record.message.content) : null;
  const queued = record.type === "attachment" && record.attachment?.type === "queued_command" ? cleanPrompt(record.attachment.prompt) : null;
  const prompt = userText ?? queued;
  if (prompt && !isSystemNotice(prompt)) {
    current = { prompt, at: record.timestamp, midTurn: Boolean(queued), replies: [], tools: [], lastAt: record.timestamp };
    exchanges.push(current);
    continue;
  }
  if (record.type === "assistant" && current) {
    for (const block of record.message.content) {
      if (block.type === "text" && block.text.trim()) current.replies.push(block.text.trim());
      if (block.type === "tool_use") current.tools.push(describeTool(block));
    }
    current.lastAt = record.timestamp;
    current.model = record.message.model ?? current.model;
  }
}

const model = records.find((record) => record.type === "assistant")?.message?.model ?? "unknown";
const toolCount = exchanges.reduce((sum, exchange) => sum + exchange.tools.length, 0);
const byTool = {};
for (const exchange of exchanges) for (const tool of exchange.tools) { const key = tool.split(/[ :(]/)[0]; byTool[key] = (byTool[key] ?? 0) + 1; }
const first = exchanges[0]?.at ?? "";
const last = exchanges.at(-1)?.lastAt ?? first;
const minutes = Math.round((Date.parse(last) - Date.parse(first)) / 60000);
let commits = "";
try { commits = execSync(`git log --since="${first}" --until="${last}" --pretty=format:"- \`%h\` %s"`, { encoding: "utf8" }); } catch { /* not a git checkout */ }

const title = (text) => text.replace(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>/g, "[pasted content]").replace(/\s+/g, " ").trim().slice(0, 90) || "(screenshot)";
const date = first.slice(0, 10);
const out = [];
out.push("---", `session_id: ${sessionId}`, `date: ${date}`, `author: ${author}`, `model: ${model}`, "tool: claude-code", "project: 8x", `total_exchanges: ${exchanges.length}`, `first_prompt_time: ${first}`, `last_prompt_time: ${exchanges.at(-1)?.at ?? first}`, "---", "");
out.push(`# Session log: ${date}`, "", `Session \`${short}\` · Project \`8x\` · Author \`${author}\` · Agent: Claude Code (${model})`, "");
out.push("## Overview", "", "| | |", "|---|---|", `| Duration | ${Math.floor(minutes / 60)} h ${minutes % 60} min |`, `| Prompts | ${exchanges.length} (${exchanges.filter((exchange) => exchange.midTurn).length} sent while the agent was working) |`, `| Tool calls | ${toolCount} (${Object.entries(byTool).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(", ")}) |`, "");
if (commits.trim()) out.push("### Commits made in this session", "", commits.trim(), "");
out.push("## Prompts", "", ...exchanges.map((exchange, index) => `${index + 1}. [${title(exchange.prompt)}](#exchange-${index + 1})`), "", "---", "");
exchanges.forEach((exchange, index) => {
  const n = index + 1;
  out.push(`<a id="exchange-${n}"></a>`, "", `[LOG_ENTRY type=PROMPT num=${n} session=${short}]`, `timestamp: ${exchange.at}`, `model: ${exchange.model ?? model}`, ...(exchange.midTurn ? ["note: sent while the agent was working"] : []), "", exchange.prompt, "");
  out.push(`[LOG_ENTRY type=RESPONSE num=${n} session=${short}]`, `timestamp: ${exchange.lastAt}`, `model: ${exchange.model ?? model}`, "", exchange.replies.join("\n\n") || "_(no text reply; see actions)_", "");
  if (exchange.tools.length) out.push(`<details><summary>Agent actions (${exchange.tools.length} tool calls)</summary>`, "", ...exchange.tools.map((tool) => `- ${tool}`), "", "</details>", "");
  out.push("---", "");
});

mkdirSync(".agent-logs", { recursive: true });
const name = `.agent-logs/${first.slice(0, 19).replace("T", "_").replace(/:/g, "-")}_claude-code-${short}.md`;
writeFileSync(name, out.join("\n"));
console.log(`wrote ${name}: ${exchanges.length} exchanges, ${toolCount} tool calls`);
