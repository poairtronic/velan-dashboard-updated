import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { CutInventoryService } from './cut-inventory.service';
import { CreateCutDto } from './dto/create-cut.dto';
import { CreateLongBarDto } from './dto/create-long-bar.dto';
import { Response } from 'express';

@Controller('api/inventory')
export class CutInventoryController {
  constructor(private readonly inventoryService: CutInventoryService) {}

  @Get('long-bars')
  async getLongBars() {
    return this.inventoryService.getAllLongBars();
  }

  @Post('long-bars')
  async createLongBar(@Body() dto: CreateLongBarDto) {
    return this.inventoryService.createLongBar(dto);
  }

  @Get('cut-pieces')
  async getCutPieces() {
    return this.inventoryService.getAllCutPieces();
  }

  @Get('stock')
  async getInventory() {
    return this.inventoryService.getInventory();
  }

  @Get('production-history')
  async getHistory() {
    return this.inventoryService.getProductionHistory();
  }

  @Post('cut-piece')
  async cutPiece(@Body() dto: CreateCutDto, @Res() res: Response) {
    const result = await this.inventoryService.cutPieceFromBar(dto);
    if (result.success) {
      return res.status(HttpStatus.OK).json(result);
    } else {
      return res.status(HttpStatus.BAD_REQUEST).json(result);
    }
  }
}
