import { invoke } from "@tauri-apps/api/core";
import type {
  BenchmarkRun,
  CompileResult,
  CursePackManifest,
  DeployDiff,
  DeployResult,
  OllamaGenerateResult,
  OllamaStatus,
  Preset,
  ProjectProfile,
  SyncStatus,
  TemplateDefinition,
} from "./types";

export const api = {
  initApp: () => invoke<number>("init_app"),
  listTemplates: () => invoke<TemplateDefinition[]>("list_templates"),
  listPresets: () => invoke<Preset[]>("list_presets"),
  getPreset: (id: string) => invoke<Preset | null>("get_preset", { id }),
  createPresetFromTemplate: (templateId: string, name?: string) =>
    invoke<Preset>("create_preset_from_template", { templateId, name }),
  savePreset: (preset: Preset) => invoke<Preset>("save_preset", { preset }),
  deletePreset: (id: string) => invoke<void>("delete_preset", { id }),
  compilePreset: (presetId: string) =>
    invoke<CompileResult>("compile_preset_cmd", { presetId }),
  compilePreview: (
    template: TemplateDefinition,
    parameters: Record<string, unknown>,
  ) =>
    invoke<CompileResult>("compile_preview_cmd", { template, parameters }),
  scanProjects: (roots?: string[]) =>
    invoke<ProjectProfile[]>("scan_projects", { roots }),
  listProjects: () => invoke<ProjectProfile[]>("list_projects"),
  saveProject: (project: ProjectProfile) =>
    invoke<ProjectProfile>("save_project", { project }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),
  previewDeploy: (presetId: string, projectPath: string) =>
    invoke<DeployDiff[]>("preview_deploy", { presetId, projectPath }),
  deployPreset: (presetId: string, projectPath: string) =>
    invoke<DeployResult>("deploy_preset", { presetId, projectPath }),
  checkSyncStatus: (projectPath: string) =>
    invoke<SyncStatus>("check_sync_status", { projectPath }),
  runBenchmark: (presetId: string, projectPath?: string) =>
    invoke<BenchmarkRun>("run_benchmark", { presetId, projectPath }),
  listBenchmarks: (presetId?: string) =>
    invoke<BenchmarkRun[]>("list_benchmarks", { presetId }),
  ollamaStatus: () => invoke<OllamaStatus>("ollama_status"),
  ollamaSetModel: (model: string) =>
    invoke<void>("ollama_set_model", { model }),
  ollamaGenerate: (prompt: string, jsonMode?: boolean) =>
    invoke<OllamaGenerateResult>("ollama_generate", { prompt, jsonMode }),
  ollamaNlToParameters: (description: string, parameterSchema: string) =>
    invoke<Record<string, unknown>>("ollama_nl_to_parameters", {
      description,
      parameterSchema,
    }),
  ollamaGenerateRuleBody: (description: string) =>
    invoke<string>("ollama_generate_rule_body", { description }),
  exportPack: (
    presetIds: string[],
    outputPath: string,
    packMeta: CursePackManifest,
  ) => invoke<string>("export_pack", { presetIds, outputPath, packMeta }),
  importPack: (packPath: string) =>
    invoke<CursePackManifest>("import_pack", { packPath }),
  initTeamLibrary: (path: string) =>
    invoke<string>("init_team_library", { path }),
  listTeamPacks: (path: string) =>
    invoke<string[]>("list_team_packs", { path }),
};
