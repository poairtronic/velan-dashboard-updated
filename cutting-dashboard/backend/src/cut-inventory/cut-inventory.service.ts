import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LongBar } from './entities/long-bar.entity';
import { CutPiece } from './entities/cut-piece.entity';
import { CutPieceInventory } from './entities/cut-piece-inventory.entity';
import { ProductionLog } from './entities/production-log.entity';
import { CreateCutDto } from './dto/create-cut.dto';
import { CreateLongBarDto } from './dto/create-long-bar.dto';

@Injectable()
export class CutInventoryService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(LongBar)
    private longBarRepository: Repository<LongBar>,
    @InjectRepository(CutPiece)
    private cutPieceRepository: Repository<CutPiece>,
    @InjectRepository(CutPieceInventory)
    private inventoryRepository: Repository<CutPieceInventory>,
    @InjectRepository(ProductionLog)
    private productionLogRepository: Repository<ProductionLog>,
  ) {}

  async createLongBar(dto: CreateLongBarDto) {
    const bar = this.longBarRepository.create({
      barType: dto.barType,
      originalLength: dto.originalLength,
      currentLength: dto.originalLength,
      status: 'Active',
    });
    return this.longBarRepository.save(bar);
  }

  async getAllLongBars() {
    return this.longBarRepository.find({ order: { id: 'DESC' } });
  }

  async getAllCutPieces() {
    return this.cutPieceRepository.find({ order: { id: 'DESC' } });
  }

  async getInventory() {
    return this.inventoryRepository.find({
      relations: ['cutPiece'],
      order: { id: 'DESC' },
    });
  }

  async getProductionHistory() {
    return this.productionLogRepository.find({
      relations: ['longBar', 'cutPiece'],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async cutPieceFromBar(dto: CreateCutDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch Long Bar
      const longBar = await queryRunner.manager.findOne(LongBar, {
        where: { id: dto.longBarId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!longBar) {
        throw new NotFoundException(`Long bar with ID ${dto.longBarId} not found`);
      }

      // 2. Find or Create Cut Piece
      let cutPiece = await queryRunner.manager.findOne(CutPiece, {
        where: { cutPieceName: dto.cutPieceName },
      });

      if (!cutPiece) {
        cutPiece = queryRunner.manager.create(CutPiece, {
          cutPieceName: dto.cutPieceName,
          parentBarType: longBar.barType,
          cutDimension: dto.cutDimension,
        });
        cutPiece = await queryRunner.manager.save(CutPiece, cutPiece);
      } else if (cutPiece.cutDimension !== dto.cutDimension) {
        throw new BadRequestException(`Existing cut piece "${dto.cutPieceName}" has a different dimension (${cutPiece.cutDimension}mm) than requested (${dto.cutDimension}mm).`);
      }

      // 3. Validate Dimensions
      const totalReduction = dto.cutDimension * dto.quantity;
      if (longBar.currentLength < totalReduction) {
        throw new BadRequestException(`Insufficient length. Bar has ${longBar.currentLength}mm, but cut requires ${totalReduction}mm.`);
      }

      const lengthBefore = longBar.currentLength;
      
      // 4. Update Long Bar
      longBar.currentLength -= totalReduction;
      if (longBar.currentLength === 0) {
        longBar.status = 'Depleted';
      } else if (longBar.currentLength < longBar.originalLength) {
        longBar.status = 'Partial';
      }
      await queryRunner.manager.save(LongBar, longBar);

      // 5. Update Inventory
      let inventory = await queryRunner.manager.findOne(CutPieceInventory, {
        where: { cutPieceId: cutPiece.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!inventory) {
        inventory = queryRunner.manager.create(CutPieceInventory, {
          cutPieceId: cutPiece.id,
          quantityAvailable: dto.quantity,
        });
      } else {
        inventory.quantityAvailable += dto.quantity;
      }
      await queryRunner.manager.save(CutPieceInventory, inventory);

      // 6. Log Production
      const log = queryRunner.manager.create(ProductionLog, {
        longBarId: longBar.id,
        cutPieceId: cutPiece.id,
        cutDimension: dto.cutDimension,
        barLengthBefore: lengthBefore,
        barLengthAfter: longBar.currentLength,
        createdBy: dto.createdBy || 'System',
      });
      await queryRunner.manager.save(ProductionLog, log);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Successfully cut ${dto.quantity} piece(s) of "${dto.cutPieceName}".`,
        data: {
          barLengthBefore: lengthBefore,
          barLengthAfter: longBar.currentLength,
        }
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      return {
        success: false,
        message: err.message || 'An error occurred during the transaction',
      };
    } finally {
      await queryRunner.release();
    }
  }
}
