import { useMemo } from "react";
import { highlight } from "../highlight";

export function Script({ text }: { text: string }) {
  const tokens = useMemo(() => highlight(text), [text]);
  return (
    <pre className="script" tabIndex={0} aria-label="Liftoscript program text">
      <code>
        {tokens.map((t, i) =>
          t.type === "plain" ? t.text : (
            <span key={i} className={`tok-${t.type}`}>
              {t.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
