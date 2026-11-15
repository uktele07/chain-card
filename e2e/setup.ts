// dist/ を配信するサーバーを立て、そのURLをテストに渡す
import { preview } from 'vite';
import type { TestProject } from 'vitest/node';

export default async function setup(project: TestProject) {
  const server = await preview({ preview: { port: 4317, strictPort: false, host: '127.0.0.1' } });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('preview server did not report a URL');
  project.provide('baseUrl', url);
  return async () => { await new Promise<void>(resolve => server.httpServer.close(() => resolve())); };
}

declare module 'vitest' {
  export interface ProvidedContext { baseUrl: string }
}
