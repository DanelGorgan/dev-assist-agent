import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { ToolsService } from '../tools/tools.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { VECTOR_STORE } from '../vector-store/vector-store.module';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockToolsService = {
      getTools: jest.fn().mockReturnValue([]),
    };

    const mockVectorStore = {
      similaritySearch: jest.fn().mockResolvedValue([]),
    };

    const mockKnowledgeService = {
      ingestDocuments: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ToolsService,
          useValue: mockToolsService,
        },
        {
          provide: VECTOR_STORE,
          useValue: mockVectorStore,
        },
        {
          provide: KnowledgeService,
          useValue: mockKnowledgeService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "DevAssist Agent API is running!"', () => {
      expect(appController.getHello()).toBe('DevAssist Agent API is running!');
    });
  });
});
