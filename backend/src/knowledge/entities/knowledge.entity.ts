import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class KnowledgeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
