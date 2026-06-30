import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CutInventoryService } from './cut-inventory.service';
import { CutInventoryController } from './cut-inventory.controller';
import { LongBar } from './entities/long-bar.entity';
import { CutPiece } from './entities/cut-piece.entity';
import { CutPieceInventory } from './entities/cut-piece-inventory.entity';
import { ProductionLog } from './entities/production-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LongBar,
      CutPiece,
      CutPieceInventory,
      ProductionLog,
    ]),
  ],
  controllers: [CutInventoryController],
  providers: [CutInventoryService],
})
export class CutInventoryModule {}
