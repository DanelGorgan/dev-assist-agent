import {
  DynamicModule,
  Global,
  Logger,
  Module,
  Provider,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { PoolConfig } from 'pg';

export const VECTOR_STORE = 'VECTOR_STORE';

@Global()
@Module({})
export class VectorStoreModule {
  private static readonly logger = new Logger(VectorStoreModule.name);

  static register(): DynamicModule {
    const vectorStoreProvider: Provider<PGVectorStore> = {
      provide: VECTOR_STORE,
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<PGVectorStore> => {
        this.logger.debug('VectorStore init START');

        const embeddings = new OllamaEmbeddings({
          model:
            configService.get<string>('OLLAMA_EMBED_MODEL') ??
            'nomic-embed-text',
          baseUrl:
            configService.get<string>('OLLAMA_BASE_URL') ??
            'http://localhost:11434',
        });

        const store = await PGVectorStore.initialize(embeddings, {
          postgresConnectionOptions: {
            type: 'postgres',
            host: configService.get<string>('DB_HOST') ?? 'localhost',
            port: configService.get<number>('DB_PORT') ?? 5433,
            user: configService.get<string>('DB_USER') ?? 'postgres',
            password: configService.get<string>('DB_PASSWORD') ?? 'postgres',
            database: configService.get<string>('DB_NAME') ?? 'rag_db',
          } as PoolConfig,
          tableName: 'documents_vector',
          columns: {
            idColumnName: 'id',
            vectorColumnName: 'embedding',
            contentColumnName: 'page_content',
            metadataColumnName: 'metadata',
          },
        });

        this.logger.debug('VectorStore init DONE');
        return store;
      },
    };

    return {
      global: true,
      module: VectorStoreModule,
      imports: [ConfigModule],
      providers: [vectorStoreProvider],
      exports: [vectorStoreProvider],
    };
  }
}
