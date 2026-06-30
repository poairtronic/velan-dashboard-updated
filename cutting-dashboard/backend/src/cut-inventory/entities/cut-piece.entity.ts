import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cut_pieces')
export class CutPiece {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cut_piece_name', length: 100, unique: true })
  cutPieceName: string;

  @Column({ name: 'parent_bar_type', length: 50 })
  parentBarType: string;

  @Column({ name: 'cut_dimension' })
  cutDimension: number;

  @Column({ default: 'mm', length: 10 })
  unit: string;

  @Column({ name: 'min_stock_threshold', default: 10 })
  minStockThreshold: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
