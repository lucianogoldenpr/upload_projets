
export interface ProjectFile {
  name: string;
  path: string;
  content: string | ArrayBuffer | null;
  size: number;
  type: string;
}

export interface ProjectMetadata {
  suggestedName: string;
  suggestedDescription: string;
  techStack: string[];
  mainLanguage: string;
}

export interface GitHubRepoConfig {
  name: string;
  description: string;
  isPrivate: boolean;
  token: string;
}

export enum PublishStatus {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  CREATING_REPO = 'CREATING_REPO',
  UPLOADING_FILES = 'UPLOADING_FILES',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}
