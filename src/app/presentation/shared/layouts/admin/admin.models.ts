export type BallType = 'SOCCER' | 'BASKETBALL' | 'TENNIS' | 'TABLE_TENNIS' | 'BADMINTON' | 'VOLLEYBALL';

export interface SportsParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  type: BallType;
  rotation: number;
  rotationSpeed: number;
}
