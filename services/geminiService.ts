
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectFile, ProjectMetadata } from "../types";

export const analyzeProject = async (files: ProjectFile[]): Promise<ProjectMetadata> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  // Pick some relevant files for context
  const manifestFiles = files.filter(f => 
    f.name === 'package.json' || 
    f.name === 'README.md' || 
    f.name === 'requirements.txt' ||
    f.name === 'pom.xml' ||
    f.name === 'go.mod'
  );

  const fileList = files.slice(0, 50).map(f => f.path).join('\n');
  const manifestContext = manifestFiles.map(f => `File: ${f.path}\nContent: ${typeof f.content === 'string' ? f.content.substring(0, 2000) : 'Binary'}`).join('\n\n');

  const prompt = `
    Analyze this project file structure and key manifest files to generate metadata for a GitHub repository.
    
    File Structure:
    ${fileList}

    Manifest Context:
    ${manifestContext}

    Respond with a suggested repository name, a concise description, the primary tech stack, and the main programming language used.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedName: { type: Type.STRING },
          suggestedDescription: { type: Type.STRING },
          techStack: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          mainLanguage: { type: Type.STRING }
        },
        required: ["suggestedName", "suggestedDescription", "techStack", "mainLanguage"]
      }
    }
  });

  return JSON.parse(response.text);
};
