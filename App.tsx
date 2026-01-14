
import React, { useState, useCallback } from 'react';
import { ProjectFile, ProjectMetadata, GitHubRepoConfig, PublishStatus } from './types';
import { analyzeProject } from './services/geminiService';
import { publishToGitHub } from './services/githubService';

// --- Sub-components (Helper Components outside main) ---

const FileUploader: React.FC<{ onFilesSelected: (files: ProjectFile[]) => void }> = ({ onFilesSelected }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const filesArray: ProjectFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relativePath = file.webkitRelativePath || file.name;
      
      // Basic heuristic: skip node_modules, .git, and common hidden folders
      if (relativePath.includes('node_modules/') || relativePath.includes('.git/') || relativePath.includes('.next/')) {
        continue;
      }

      const content = await new Promise<string | ArrayBuffer | null>((resolve) => {
        const reader = new FileReader();
        // Updated text detection to include .bat and .csv
        const isText = /\.(ts|tsx|js|jsx|json|md|txt|html|css|py|java|c|cpp|go|rs|rb|php|sh|yml|yaml|xml|bat|csv)$/i.test(file.name);
        
        reader.onload = () => resolve(reader.result);
        if (isText) {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });

      filesArray.push({
        name: file.name,
        path: relativePath,
        content,
        size: file.size,
        type: file.type
      });
    }

    onFilesSelected(filesArray);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/50 hover:bg-slate-900 transition-colors group">
      <div className="mb-4 text-slate-500 group-hover:text-blue-400 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <h3 className="text-xl font-medium mb-2">Carregar Projeto Local</h3>
      <p className="text-slate-400 mb-6 text-center max-w-md">
        Selecione a pasta do seu projeto. O GitShip AI irá ignorar pastas como <code className="bg-slate-800 px-1 rounded">node_modules</code> automaticamente.
      </p>
      <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-95">
        Selecionar Pasta
        <input 
          type="file" 
          className="hidden" 
          webkitdirectory="true" 
          multiple 
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
};

const ProjectPreview: React.FC<{ 
  files: ProjectFile[], 
  metadata: ProjectMetadata | null,
  isAnalyzing: boolean,
  onPublish: (config: GitHubRepoConfig) => void
}> = ({ files, metadata, isAnalyzing, onPublish }) => {
  const [repoName, setRepoName] = useState(metadata?.suggestedName || '');
  const [repoDesc, setRepoDesc] = useState(metadata?.suggestedDescription || '');
  const [token, setToken] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  React.useEffect(() => {
    if (metadata) {
      setRepoName(metadata.suggestedName);
      setRepoDesc(metadata.suggestedDescription);
    }
  }, [metadata]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName || !token) return;
    onPublish({ name: repoName, description: repoDesc, isPrivate, token });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Arquivos do Projeto ({files.length})
        </h3>
        <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 text-sm hover:bg-slate-800 transition-colors">
              <span className="truncate flex-1 font-mono text-slate-300">{file.path}</span>
              <span className="text-slate-500 ml-4">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Análise Gemini AI
          </h3>
          {isAnalyzing ? (
            <div className="flex items-center gap-3 text-blue-400 animate-pulse py-4">
              <div className="w-4 h-4 rounded-full bg-blue-400 animate-ping" />
              <span>Gerando metadados inteligentes...</span>
            </div>
          ) : metadata ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-2">
                {metadata.techStack.map(tech => (
                  <span key={tech} className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">{tech}</span>
                ))}
                <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-xs font-medium border border-orange-500/20">{metadata.mainLanguage}</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Pronto para analisar seu projeto.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Nome do Repositório</label>
            <input 
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
              value={repoName} 
              onChange={e => setRepoName(e.target.value)}
              placeholder="meu-projeto-incrivel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
            <textarea 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none" 
              value={repoDesc} 
              onChange={e => setRepoDesc(e.target.value)}
              placeholder="Uma breve descrição do que o seu projeto faz..."
            />
          </div>
          <div className="flex items-center gap-3 mb-6 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
             <input 
              type="checkbox" 
              id="isPrivate"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
             />
             <label htmlFor="isPrivate" className="text-sm text-slate-300">Repositório Privado</label>
          </div>
          
          <div className="pt-4 border-t border-slate-800">
             <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
               GitHub Personal Access Token
               <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                 Criar Token
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                 </svg>
               </a>
             </label>
             <input 
              required
              type="password"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" 
              value={token} 
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            />
            <p className="text-[10px] text-slate-500 mt-2">
              Nota: O token precisa de escopo 'repo' para criar e enviar arquivos. Seu token não é salvo em nenhum lugar.
            </p>
          </div>

          <button 
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            Publicar no GitHub
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(PublishStatus.IDLE);
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 });
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (newFiles: ProjectFile[]) => {
    setFiles(newFiles);
    setPublishedUrl(null);
    setError(null);
    setPublishStatus(PublishStatus.IDLE);
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeProject(newFiles);
      setMetadata(result);
    } catch (err) {
      console.error("Gemini analysis failed:", err);
      // Fallback metadata if Gemini fails
      setMetadata({
        suggestedName: "my-github-project",
        suggestedDescription: "A project published via GitShip AI",
        techStack: [],
        mainLanguage: "Unknown"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublish = async (config: GitHubRepoConfig) => {
    setPublishStatus(PublishStatus.PREPARING);
    setError(null);
    setPublishProgress({ current: 0, total: files.length });

    try {
      setPublishStatus(PublishStatus.CREATING_REPO);
      const url = await publishToGitHub(config, files, (current, total) => {
        setPublishStatus(PublishStatus.UPLOADING_FILES);
        setPublishProgress({ current, total });
      });
      setPublishedUrl(url);
      setPublishStatus(PublishStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao publicar no GitHub.');
      setPublishStatus(PublishStatus.FAILED);
    }
  };

  const reset = () => {
    setFiles([]);
    setMetadata(null);
    setPublishStatus(PublishStatus.IDLE);
    setPublishedUrl(null);
    setError(null);
  };

  return (
    <div className="min-h-screen pb-20 px-4 pt-12 max-w-7xl mx-auto flex flex-col items-center">
      <header className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          IA Integrada com GitHub
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
          GitShip AI
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Prepare, analise e implante seus projetos locais no GitHub em segundos com o poder do Gemini AI.
        </p>
      </header>

      <main className="w-full flex flex-col items-center">
        {publishStatus === PublishStatus.IDLE || publishStatus === PublishStatus.FAILED ? (
          <>
            {files.length === 0 ? (
              <FileUploader onFilesSelected={handleFilesSelected} />
            ) : (
              <div className="w-full space-y-8">
                <div className="flex justify-between items-center w-full">
                  <button onClick={reset} className="text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Selecionar outro projeto
                  </button>
                  {error && <div className="text-red-400 font-medium bg-red-900/20 border border-red-500/20 px-4 py-2 rounded-lg">{error}</div>}
                </div>
                <ProjectPreview 
                  files={files} 
                  metadata={metadata} 
                  isAnalyzing={isAnalyzing} 
                  onPublish={handlePublish}
                />
              </div>
            )}
          </>
        ) : publishStatus === PublishStatus.COMPLETED ? (
          <div className="w-full max-w-2xl bg-slate-900 border border-emerald-500/30 p-12 rounded-3xl text-center space-y-8 animate-in fade-in zoom-in duration-500">
             <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
               </svg>
             </div>
             <div>
               <h2 className="text-3xl font-bold mb-2">Projeto Publicado!</h2>
               <p className="text-slate-400">Seu código agora está seguro no GitHub.</p>
             </div>
             <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
               <p className="text-sm font-mono text-slate-300 break-all">{publishedUrl}</p>
               <a 
                href={publishedUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors"
               >
                 Ver no GitHub
               </a>
             </div>
             <button onClick={reset} className="text-slate-500 hover:text-white underline underline-offset-4 font-medium transition-colors">
               Publicar outro projeto
             </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center space-y-10">
            <div className="relative w-32 h-32 mx-auto">
               <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
               <div 
                className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
                style={{ animationDuration: '0.8s' }}
               ></div>
               <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
                 {publishProgress.total > 0 ? Math.round((publishProgress.current / publishProgress.total) * 100) : 0}%
               </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">
                {publishStatus === PublishStatus.CREATING_REPO ? 'Criando repositório...' : 'Enviando arquivos...'}
              </h2>
              <p className="text-slate-400 italic">
                {publishStatus === PublishStatus.UPLOADING_FILES 
                  ? `Enviando arquivo ${publishProgress.current} de ${publishProgress.total}`
                  : 'Preparando seu ambiente remoto no GitHub...'}
              </p>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
               <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${publishProgress.total > 0 ? (publishProgress.current / publishProgress.total) * 100 : 0}%` }}
               ></div>
            </div>
            <p className="text-xs text-slate-500">Isso pode levar alguns minutos dependendo do tamanho do projeto.</p>
          </div>
        )}
      </main>

      <footer className="mt-24 text-slate-600 text-sm flex items-center gap-6">
        <span>© 2024 GitShip AI</span>
        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
        <span>Powered by Google Gemini 3</span>
        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
        <a href="#" className="hover:text-slate-400 transition-colors">Github API Integration</a>
      </footer>
    </div>
  );
};

export default App;
