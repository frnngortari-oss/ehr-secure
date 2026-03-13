import { Fragment, type ReactNode } from "react";

type Props = {
  text?: string | null;
};

function parseInline(input: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|__([^_]+)__)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let part = 0;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(input.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(<strong key={`${keyPrefix}-b-${part}`}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<u key={`${keyPrefix}-u-${part}`}>{match[3]}</u>);
    }

    lastIndex = match.index + match[0].length;
    part += 1;
  }

  if (lastIndex < input.length) {
    nodes.push(input.slice(lastIndex));
  }

  return nodes;
}

export default function FormattedEvolutionText({ text }: Props) {
  const value = (text ?? "").trim();
  if (!value) return null;

  const lines = value.split(/\r?\n/);
  return (
    <>
      {lines.map((line, idx) => (
        <Fragment key={`line-${idx}`}>
          {parseInline(line, `line-${idx}`)}
          {idx < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </>
  );
}
