#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

const DATA_DIR =
  process.env.CURSE_BOOK_DATA ??
  join(homedir(), ".local", "share", "curse-book");

interface PresetRecord {
  id: string;
  templateId: string;
  name: string;
  parameters: Record<string, unknown>;
}

async function invokeTauriCli(
  command: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const cliPath = process.env.CURSE_BOOK_CLI;
  if (cliPath) {
    const { stdout } = await execFileAsync(cliPath, [
      command,
      JSON.stringify(args),
    ]);
    return JSON.parse(stdout);
  }
  return readLocalState(command, args);
}

async function readLocalState(
  command: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const dbPath = join(DATA_DIR, "curse-book.db");
  try {
    await readFile(dbPath);
  } catch {
    return { error: "Curse Book database not found. Run the desktop app first." };
  }

  switch (command) {
    case "list_presets":
      return listPresetsFromManifest();
    case "apply_preset":
      return applyPresetLocal(
        args.presetId as string,
        args.projectPath as string,
      );
    case "sync_status":
      return checkSyncLocal(args.projectPath as string);
    default:
      return { error: `Unknown command: ${command}` };
  }
}

async function listPresetsFromManifest(): Promise<{ presets: PresetRecord[] }> {
  const manifestPath = join(DATA_DIR, "mcp-presets.json");
  try {
    const raw = await readFile(manifestPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { presets: [] };
  }
}

async function applyPresetLocal(
  presetId: string,
  projectPath: string,
): Promise<{ success: boolean; message: string }> {
  const presets = await listPresetsFromManifest();
  const preset = presets.presets.find((p) => p.id === presetId);
  if (!preset) {
    return { success: false, message: `Preset not found: ${presetId}` };
  }

  const manifestPath = join(projectPath, ".curse", "book.manifest.json");
  await mkdir(join(projectPath, ".curse"), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        presetId,
        presetName: preset.name,
        deployedAt: new Date().toISOString(),
        deployedVia: "curse-book-mcp",
      },
      null,
      2,
    ),
  );

  return {
    success: true,
    message: `Applied preset "${preset.name}" to ${projectPath}. Use the desktop app for full artifact compilation.`,
  };
}

async function checkSyncLocal(
  projectPath: string,
): Promise<{ inSync: boolean; driftedFiles: string[] }> {
  const manifestPath = join(projectPath, ".curse", "book.manifest.json");
  try {
    await readFile(manifestPath, "utf-8");
    return { inSync: true, driftedFiles: [] };
  } catch {
    return { inSync: false, driftedFiles: [".curse/book.manifest.json"] };
  }
}

const server = new Server(
  { name: "curse-book-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "curse_list_presets",
      description: "List installed Curse Book presets",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "curse_apply_preset",
      description: "Apply a preset to a project workspace",
      inputSchema: {
        type: "object",
        properties: {
          presetId: { type: "string", description: "Preset ID to apply" },
          projectPath: {
            type: "string",
            description: "Absolute path to project root",
          },
        },
        required: ["presetId", "projectPath"],
      },
    },
    {
      name: "curse_sync_status",
      description: "Check if project manifest is in sync",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
        },
        required: ["projectPath"],
      },
    },
    {
      name: "curse_export_pack",
      description: "Export presets as a pack (requires desktop app)",
      inputSchema: {
        type: "object",
        properties: {
          presetIds: {
            type: "array",
            items: { type: "string" },
          },
          outputPath: { type: "string" },
        },
        required: ["presetIds", "outputPath"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "curse_list_presets": {
      const result = await invokeTauriCli("list_presets", {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "curse_apply_preset": {
      const result = await applyPresetLocal(
        (args as { presetId: string }).presetId,
        (args as { projectPath: string }).projectPath,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "curse_sync_status": {
      const result = await checkSyncLocal(
        (args as { projectPath: string }).projectPath,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "curse_export_pack": {
      return {
        content: [
          {
            type: "text",
            text: "Use the Curse Book desktop app Packs page for full export with compiled artifacts.",
          },
        ],
      };
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
