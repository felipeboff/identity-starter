export class RabbitTopology {
  readonly exchange: string;
  readonly deadQueue: string;

  constructor(private readonly prefix: string) {
    this.exchange = `${prefix}.events`;
    this.deadQueue = `${prefix}.dead`;
  }

  queueOf(consumer: string): string {
    return `${this.prefix}.${consumer}`;
  }
}
