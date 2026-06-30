import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('long_bars')
export class LongBar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'bar_type', length: 50 })
  barType: string;

  @Column({ name: 'original_length' })
  originalLength: number;

  @Column({ name: 'current_length' })
  currentLength: number;

  @Column({ default: 'Active', length: 20 })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
