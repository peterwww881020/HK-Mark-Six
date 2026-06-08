export interface Draw {
  id: number;
  date: string;
  draw_number: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  n6: number;
  extra_number: number;
}

export interface Stat {
  num: number;
  frequency: number;
}

export interface CheckResult {
  date: string;
  draw_number: string;
  drawNumbers: number[];
  extra: number;
  matchCount: number;
  extraMatch: boolean;
  prize: string;
}
