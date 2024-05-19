export interface Operation {
  name: string;
  fn: (input: any) => any;
}
