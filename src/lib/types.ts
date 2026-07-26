export type ArtifactType =
  | "rule"
  | "skill"
  | "subagent"
  | "hook"
  | "mcp"
  | "plugin";

export interface ParameterField {
  key: string;
  label: string;
  fieldType: "toggle" | "slider" | "select" | "text" | "globs";
  default: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface RuleFrontmatter {
  description: string;
  globs?: string;
  alwaysApply: boolean;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  disableModelInvocation?: boolean;
}

export interface SubagentFrontmatter {
  name: string;
  description: string;
  model?: string;
  isBackground?: boolean;
}

export interface HookScript {
  path: string;
  content: string;
  executable?: boolean;
}

export interface HookBundle {
  hooksJson: string;
  scripts?: HookScript[];
}

export interface McpFrontmatter {
  serverKey: string;
  configTemplate: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  childTemplateIds?: string[];
}

export interface PluginBundleFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface PluginBundle {
  manifest?: Record<string, unknown>;
  files: PluginBundleFile[];
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  artifactType: ArtifactType | string;
  tags: string[];
  parameters: ParameterField[];
  ruleFrontmatter?: RuleFrontmatter;
  skillFrontmatter?: SkillFrontmatter;
  subagentFrontmatter?: SubagentFrontmatter;
  hookBundle?: HookBundle;
  mcpFrontmatter?: McpFrontmatter;
  pluginManifest?: PluginManifest;
  pluginBundle?: PluginBundle;
  bodyTemplate: string;
  source?: string;
  sourceUrl?: string;
  sourceRepo?: string;
  sourcePath?: string;
  highlights?: string[];
  updatedAt?: string;
}

export interface Preset {
  id: string;
  templateId: string;
  name: string;
  description: string;
  artifactType: ArtifactType | string;
  parameters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProfile {
  id: string;
  name: string;
  path: string;
  presetIds: string[];
  lastDeployedAt?: string;
}

export interface CompiledArtifact {
  artifactType: string;
  relativePath: string;
  content: string;
  executable?: boolean;
}

export interface CompileResult {
  artifacts: CompiledArtifact[];
  tokenEstimate: number;
  lineCount: number;
}

export interface TemplateStats {
  templateId: string;
  tokenEstimate: number;
  lineCount: number;
}

export interface DeployDiff {
  path: string;
  action: string;
  oldContent?: string;
  newContent: string;
}

export interface DeployResult {
  projectPath: string;
  deployedFiles: string[];
  manifestPath: string;
}

export interface BenchmarkRun {
  id: string;
  presetId: string;
  presetName: string;
  tokenEstimate: number;
  lineCount: number;
  globMatchCount: number;
  adherenceScore?: number;
  createdAt: string;
}

export interface OllamaStatus {
  available: boolean;
  models: string[];
  selectedModel?: string;
}

export interface OllamaGenerateResult {
  response: string;
  model: string;
}

export interface SyncStatus {
  projectPath: string;
  inSync: boolean;
  driftedFiles: string[];
}

export interface GitStatusSummary {
  isRepo: boolean;
  dirty: boolean;
  unrelatedFiles: string[];
}

export interface GitResultPayload {
  stagedFiles: string[];
  commitSha?: string;
  message: string;
}

export interface CursePackManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  templates: string[];
}

export interface InstalledPlugin {
  id: string;
  name: string;
  version?: string;
  path: string;
  checksum?: string;
  installedAt: string;
}

export interface PluginSource {
  id: string;
  repo: string;
  commitSha?: string;
  importedAt: string;
  pluginCount: number;
}

export interface CatalogSourceEntry {
  id: string;
  repo: string;
  starsAtReview?: number;
  license?: string | null;
  artifactTypes?: string[];
  importScript?: string | null;
  shipped?: boolean;
  referenceOnly?: boolean;
  referenceUrl?: string;
  notes?: string;
}

export interface McpMergePreview {
  path: string;
  serverKey: string;
  keyExists: boolean;
  oldContent?: string;
  newContent: string;
}

export type DeployTargetKind =
  | "project"
  | "user_cursebook"
  | "user_agents"
  | "user_hooks"
  | "user_mcp"
  | "plugin_local";

export type CatalogArtifactFilter = "all" | ArtifactType;

export type CatalogSourceFilter = "all" | "curse-book" | string;
