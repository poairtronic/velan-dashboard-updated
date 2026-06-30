import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LongBar } from './long-bar.entity';
import { CutPiece } from './cut-piece.entity';

@Entity('production_logs')
export class ProductionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'long_bar_id' })
  longBarId: number;

  @ManyToOne(() => LongBar)
  @JoinColumn({ name: 'long_bar_id' })
  longBar: LongBar;

  @Column({ name: 'cut_piece_id' })
  cutPieceId: number;

  @ManyToOne(() => CutPiece)
  @JoinColumn({ name: 'cut_piece_id' })
  cutPiece: CutPiece;

  @Column({ name: 'cut_dimension' })
  cutDimension: number;

  @Column({ name: 'bar_length_before' })
  barLengthBefore: number;

  @Column({ name: 'bar_length_after' })
  barLengthAfter: number;

  @Column({ name: 'created_by', length: 100, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
