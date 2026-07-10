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

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  artifactType: string;
  tags: string[];
  parameters: ParameterField[];
  ruleFrontmatter?: RuleFrontmatter;
  skillFrontmatter?: SkillFrontmatter;
  bodyTemplate: string;
  source?: string;
}

export interface Preset {
  id: string;
  templateId: string;
  name: string;
  description: string;
  artifactType: string;
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
}

export interface CompileResult {
  artifacts: CompiledArtifact[];
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

export interface CursePackManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  templates: string[];
}
