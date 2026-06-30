import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { CutPiece } from './cut-piece.entity';

@Entity('cut_piece_inventory')
export class CutPieceInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cut_piece_id', unique: true })
  cutPieceId: number;

  @OneToOne(() => CutPiece)
  @JoinColumn({ name: 'cut_piece_id' })
  cutPiece: CutPiece;

  @Column({ name: 'quantity_available', default: 0 })
  quantityAvailable: number;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;
}
