export type LogFields = Readonly<Record<string, unknown>>;

export type LogEvent<Fields extends LogFields | undefined = undefined> =
  Readonly<{
    name: string;
    $fields?: Fields;
  }>;

export function defineLogEvent<
  Fields extends LogFields | undefined = undefined,
>(name: string): LogEvent<Fields> {
  return { name };
}
