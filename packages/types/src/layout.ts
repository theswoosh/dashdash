// Mirrors react-grid-layout's Layout item
export interface Layout {
  i: string;  // widget/service id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}
