import { invoke } from "@tauri-apps/api/core";
import type {
  BenchmarkRun,
  CatalogSourceEntry,
  CompileResult,
  CursePackManifest,
  DeployDiff,
  DeployResult,
  DeployTargetKind,
  GitResultPayload,
  GitStatusSummary,
  InstalledPlugin,
  McpMergePreview,
  OllamaGenerateResult,
  OllamaStatus,
  Preset,
  PluginSource,
  ProjectProfile,
  SyncStatus,
  TemplateDefinition,
  TemplateStats,
} from "./types";

export const api = {
  initApp: () => invoke<number>("init_app"),
  listTemplates: () => invoke<TemplateDefinition[]>("list_templates"),
  listPresets: () => invoke<Preset[]>("list_presets"),
  getPreset: (id: string) => invoke<Preset | null>("get_preset", { id }),
  createPresetFromTemplate: (
    templateId: string,
    name?: string,
    parameters?: Record<string, unknown>,
  ) =>
    invoke<Preset>("create_preset_from_template", {
      templateId,
      name,
      parameters,
    }),
  savePreset: (preset: Preset) => invoke<Preset>("save_preset", { preset }),
  deletePreset: (id: string) => invoke<void>("delete_preset", { id }),
  compilePreset: (presetId: string) =>
    invoke<CompileResult>("compile_preset_cmd", { presetId }),
  compilePreview: (
    template: TemplateDefinition,
    parameters: Record<string, unknown>,
  ) =>
    invoke<CompileResult>("compile_preview_cmd", { template, parameters }),
  getTemplateStats: (templateIds: string[]) =>
    invoke<TemplateStats[]>("get_template_stats", {
      templateIds,
    }),
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
  previewDeployToUser: (presetId: string) =>
    invoke<DeployDiff[]>("preview_deploy_to_user", { presetId }),
  deployPresetToUser: (presetId: string) =>
    invoke<DeployResult>("deploy_preset_to_user", { presetId }),
  previewDeployWithTarget: (
    presetId: string,
    targetKind: DeployTargetKind,
    projectPath?: string,
    pluginName?: string,
  ) =>
    invoke<DeployDiff[]>("preview_deploy_with_target", {
      presetId,
      targetKind,
      projectPath,
      pluginName,
    }),
  deployPresetWithTarget: (
    presetId: string,
    targetKind: DeployTargetKind,
    projectPath?: string,
    pluginName?: string,
  ) =>
    invoke<DeployResult>("deploy_preset_with_target", {
      presetId,
      targetKind,
      projectPath,
      pluginName,
    }),
  mergePreviewMcp: (
    presetId: string,
    targetKind: DeployTargetKind,
    projectPath?: string,
  ) =>
    invoke<McpMergePreview>("merge_preview_mcp", {
      presetId,
      targetKind,
      projectPath,
    }),
  listInstalledPlugins: () =>
    invoke<InstalledPlugin[]>("list_installed_plugins"),
  uninstallPlugin: (name: string) =>
    invoke<void>("uninstall_plugin", { name }),
  checkPluginSync: (name: string) =>
    invoke<SyncStatus>("check_plugin_sync", { name }),
  getMcpEnvVars: (presetId: string) =>
    invoke<string[]>("get_mcp_env_vars", { presetId }),
  getTemplateMcpEnvVars: (templateId: string) =>
    invoke<string[]>("get_template_mcp_env_vars", { templateId }),
  checkSyncStatus: (projectPath: string) =>
    invoke<SyncStatus>("check_sync_status", { projectPath }),
  checkGlobalSyncStatus: () =>
    invoke<SyncStatus>("check_global_sync_status"),
  assignPresetToProject: (projectId: string, presetId: string) =>
    invoke<ProjectProfile>("assign_preset_to_project", {
      projectId,
      presetId,
    }),
  unassignPresetFromProject: (projectId: string, presetId: string) =>
    invoke<ProjectProfile>("unassign_preset_from_project", {
      projectId,
      presetId,
    }),
  deployProjectPresets: (projectId: string) =>
    invoke<DeployResult[]>("deploy_project_presets", { projectId }),
  listProjectsForPreset: (presetId: string) =>
    invoke<ProjectProfile[]>("list_projects_for_preset", { presetId }),
  gitStatusProject: (projectPath: string, force?: boolean) =>
    invoke<GitStatusSummary>("git_status_project", { projectPath, force }),
  gitStageProject: (projectPath: string) =>
    invoke<string[]>("git_stage_project", { projectPath }),
  gitCommitProject: (projectPath: string, message?: string) =>
    invoke<GitResultPayload>("git_commit_project", { projectPath, message }),
  gitPushProject: (projectPath: string) =>
    invoke<GitResultPayload>("git_push_project", { projectPath }),
  gitShipProject: (
    projectPath: string,
    message?: string,
    push?: boolean,
    force?: boolean,
  ) =>
    invoke<GitResultPayload>("git_ship_project", {
      projectPath,
      message,
      push: push ?? false,
      force,
    }),
  openInCursor: (projectPath: string) =>
    invoke<void>("open_in_cursor", { projectPath }),
  exportUserRuleText: (presetId: string) =>
    invoke<string>("export_user_rule_text", { presetId }),
  getMcpConfigSnippet: () => invoke<string>("get_mcp_config_snippet"),
  getScanRoots: () => invoke<string[]>("get_scan_roots"),
  setScanRoots: (roots: string[]) =>
    invoke<void>("set_scan_roots", { roots }),
  getCustomCatalogPaths: () => invoke<string[]>("get_custom_catalog_paths"),
  setCustomCatalogPaths: (paths: string[]) =>
    invoke<number>("set_custom_catalog_paths", { paths }),
  listCatalogSources: () =>
    invoke<CatalogSourceEntry[]>("list_catalog_sources"),
  listCatalogImportMeta: () =>
    invoke<PluginSource[]>("list_catalog_import_meta"),
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
  getSetting: (key: string) =>
    invoke<string | null>("get_setting_cmd", { key }),
  setSetting: (key: string, value: string) =>
    invoke<void>("set_setting_cmd", { key, value }),
};
