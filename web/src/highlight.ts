export type TokenType =
  | "plain"
  | "header"
  | "comment"
  | "exercise"
  | "weight"
  | "timer"
  | "keyword"
  | "script"
  | "sep";

export interface Token {
  type: TokenType;
  text: string;
}

const INLINE = /(\{~)|(~\})|(\b\d+(?:\.\d+)?(?:kg|lb)\b)|(\b\d+(?:\.\d+)?s\b)|(\b(?:progress|warmup):)|( \/ )/g;

/** Tokenise Liftoscript for light syntax highlighting. Concatenating all token texts yields the input. */
export function highlight(text: string): Token[] {
  const out: Token[] = [];
  const push = (type: TokenType, t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += t;
    else out.push({ type, text: t });
  };
  let inScript = false;
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const nl = i < lines.length - 1 ? "\n" : "";
    if (inScript) {
      const end = line.indexOf("~}");
      if (end === -1) {
        push("script", line + nl);
        return;
      }
      push("script", line.slice(0, end + 2));
      inScript = false;
      line = line.slice(end + 2);
      lineBody(line, false);
      push("plain", nl);
      return;
    }
    if (line.trimStart().startsWith("//")) {
      push("comment", line + nl);
      return;
    }
    if (line.startsWith("#")) {
      push("header", line + nl);
      return;
    }
    lineBody(line, true);
    push("plain", nl);

    function lineBody(body: string, withExercise: boolean): void {
      let start = 0;
      if (withExercise) {
        const slash = body.indexOf("/");
        const name = slash === -1 ? body : body.slice(0, slash).replace(/\s+$/, "");
        if (name && slash !== -1) {
          push("exercise", name);
          start = name.length;
        }
      }
      INLINE.lastIndex = start;
      let pos = start;
      let m: RegExpExecArray | null;
      while ((m = INLINE.exec(body))) {
        push("plain", body.slice(pos, m.index));
        pos = m.index + m[0].length;
        if (m[1]) {
          const end = body.indexOf("~}", pos);
          if (end === -1) {
            push("script", m[0] + body.slice(pos));
            inScript = true;
            return;
          }
          push("script", body.slice(m.index, end + 2));
          pos = end + 2;
          INLINE.lastIndex = pos;
        } else if (m[3]) push("weight", m[0]);
        else if (m[4]) push("timer", m[0]);
        else if (m[5]) push("keyword", m[0]);
        else if (m[6]) push("sep", m[0]);
        else push("plain", m[0]);
      }
      push("plain", body.slice(pos));
    }
  });
  return out;
}
