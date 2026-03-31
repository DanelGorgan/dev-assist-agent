import { Controller, Post, Body, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { KnowledgeService } from './knowledge/knowledge.service';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  @Get('chat')
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('chat')
  async handleChat(@Body() body: { message: string }) {
    console.log(`Received message: ${body.message}`);
    const reply = await this.appService.chat(body.message);
    return { reply };
  }

  @Post('knowledge/ingest')
  async ingestKnowledge() {
    return await this.knowledgeService.ingestDocuments();
  }

  @Post('knowledge/clear')
  async clearKnowledge() {
    return await this.knowledgeService.clearVectorStore();
  }
}
