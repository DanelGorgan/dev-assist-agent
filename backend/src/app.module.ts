import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ToolsModule } from './tools/tools.module';
import { VectorStoreModule } from './vector-store/vector-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    VectorStoreModule.register(),
    KnowledgeModule,
    ToolsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
