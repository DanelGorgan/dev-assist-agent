import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { VECTOR_STORE } from '../vector-store/vector-store.module';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(@Inject(VECTOR_STORE) private vectorStore: PGVectorStore) {}

  async clearVectorStore() {
    this.logger.log('Clearing vector store...');
    try {
      await this.vectorStore.delete({});
      this.logger.log('Vector store cleared successfully');
      return { success: true };
    } catch (e) {
      this.logger.error(
        `Failed to clear vector store: ${(e as Error).message}`,
      );
      return { success: false, error: (e as Error).message };
    }
  }

  async ingestDocuments() {
    this.logger.log('Starting document ingestion...');

    await this.clearVectorStore();

    const dataDir = path.join(__dirname, '..', '..', 'data');

    if (!fs.existsSync(dataDir)) {
      this.logger.warn(`Data directory not found at ${dataDir}`);
      return { success: false, message: 'Data directory not found' };
    }

    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.md'));
    if (files.length === 0) {
      return { success: false, message: 'No markdown files found' };
    }

    const docs = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      docs.push({ pageContent: content, metadata: { source: file } });
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200,
    });

    const chunkedDocs = await splitter.createDocuments(
      docs.map((d) => d.pageContent),
      docs.map((d) => d.metadata),
    );

    await this.vectorStore.addDocuments(chunkedDocs);
    this.logger.log(
      `Successfully ingested ${chunkedDocs.length} chunks from ${files.length} files.`,
    );

    return { success: true, chunksIngested: chunkedDocs.length };
  }
}
