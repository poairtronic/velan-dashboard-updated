import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CutInventoryModule } from './cut-inventory/cut-inventory.module';
import { LongBar } from './cut-inventory/entities/long-bar.entity';
import { CutPiece } from './cut-inventory/entities/cut-piece.entity';
import { CutPieceInventory } from './cut-inventory/entities/cut-piece-inventory.entity';
import { ProductionLog } from './cut-inventory/entities/production-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/velan',
      entities: [LongBar, CutPiece, CutPieceInventory, ProductionLog],
      synchronize: false, // Using manual migrations
      ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon') ? { rejectUnauthorized: false } : false
    }),
    CutInventoryModule,
  ],
})
export class AppModule {}
