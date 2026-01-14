
import { GitHubRepoConfig, ProjectFile } from "../types";

/**
 * Safely converts string or ArrayBuffer to Base64.
 * Handles UTF-8 characters in strings and avoids stack overflow on large buffers.
 */
const toBase64 = (data: string | ArrayBuffer | null): string => {
  if (!data) return "";
  
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = new Uint8Array(data);
  }

  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const publishToGitHub = async (
  config: GitHubRepoConfig, 
  files: ProjectFile[],
  onProgress: (current: number, total: number) => void
) => {
  const { name, description, isPrivate, token } = config;

  // 1. Create Repository
  const repoResponse = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true
    })
  });

  if (!repoResponse.ok) {
    const error = await repoResponse.json();
    throw new Error(error.message || 'Failed to create repository');
  }

  const repoData = await repoResponse.json();
  const owner = repoData.owner.login;

  // 2. Upload Files
  let uploadedCount = 0;
  for (const file of files) {
    // Correctly encode each segment of the path to handle spaces and special characters
    const encodedPath = file.path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');

    const base64Content = toBase64(file.content);

    const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${encodedPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add ${file.path} via GitShip AI`,
        content: base64Content
      })
    });

    if (!fileResponse.ok) {
        const errorData = await fileResponse.json();
        console.error(`Failed to upload ${file.path}:`, errorData.message);
        // We throw here to stop the process if a file fails, or you could continue
        throw new Error(`Erro ao enviar arquivo ${file.path}: ${errorData.message}`);
    } else {
        uploadedCount++;
        onProgress(uploadedCount, files.length);
    }
  }

  return repoData.html_url;
};
