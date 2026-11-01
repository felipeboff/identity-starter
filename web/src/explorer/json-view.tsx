type JsonTokenKind = "key" | "string" | "number" | "literal" | "plain";

type JsonToken = {
  kind: JsonTokenKind;
  text: string;
};

const TOKEN_PATTERN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

export class JsonHighlighter {
  tokens(text: string): JsonToken[] {
    const tokens: JsonToken[] = [];
    let cursor = 0;
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      const index = match.index ?? 0;
      if (index > cursor)
        tokens.push({ kind: "plain", text: text.slice(cursor, index) });
      tokens.push({ kind: this.kindOf(match[0]), text: match[0] });
      cursor = index + match[0].length;
    }
    if (cursor < text.length)
      tokens.push({ kind: "plain", text: text.slice(cursor) });
    return tokens;
  }

  private kindOf(token: string): JsonTokenKind {
    if (token.startsWith('"'))
      return token.trimEnd().endsWith(":") ? "key" : "string";
    if (token === "true" || token === "false" || token === "null")
      return "literal";
    return "number";
  }
}

const highlighter = new JsonHighlighter();

export type JsonViewProps = {
  value: unknown;
};

export const JsonView = (props: JsonViewProps) => {
  const text =
    typeof props.value === "string"
      ? props.value
      : JSON.stringify(props.value, null, 2);
  return (
    <pre class="code-block">
      <code>
        {highlighter.tokens(text).map((token, index) =>
          token.kind === "plain" ? (
            token.text
          ) : (
            <span key={index} class={`json-${token.kind}`}>
              {token.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
};
