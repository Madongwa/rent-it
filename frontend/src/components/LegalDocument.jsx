import { Fragment } from 'react';
import { COMPANY, isPlaceholder } from '../content/legal';

// Renders a legal document written as data (see content/terms.js and
// content/privacy.js): each section has an id (for the contents list and
// deep links) and a body of paragraphs, bullet lists, sub-headings and
// callouts. Text can reference company details as {{key}} (e.g.
// {{legalName}}); ones not filled in yet are highlighted so they're
// impossible to miss.
function Text({ children }) {
  const parts = String(children).split(/(\{\{\w+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{\{(\w+)\}\}$/);
    if (!match) return <Fragment key={i}>{part}</Fragment>;
    const value = COMPANY[match[1]] ?? part;
    return isPlaceholder(value) ? (
      <mark key={i} className="rounded bg-amber-400/20 px-1 text-amber-300">
        {value}
      </mark>
    ) : (
      <Fragment key={i}>{value}</Fragment>
    );
  });
}

function Block({ block }) {
  if (typeof block === 'string') return <p><Text>{block}</Text></p>;
  if (block.heading) return <h3 className="pt-2 text-base font-semibold text-night-text"><Text>{block.heading}</Text></h3>;
  if (block.callout) {
    return (
      <p className="rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100">
        <Text>{block.callout}</Text>
      </p>
    );
  }
  if (block.list) {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-5`}>
        {block.list.map((item, i) => (
          <li key={i}>
            <Text>{item}</Text>
          </li>
        ))}
      </ListTag>
    );
  }
  return null;
}

export default function LegalDocument({ sections }) {
  return (
    <>
      <nav aria-label="Contents" className="mt-8 rounded-card border border-night-border/15 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-night-muted">Contents</h2>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-night-muted hover:text-night-text hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
          <h2 className="text-subheading text-night-text">
            {i + 1}. {s.title}
          </h2>
          <div className="mt-3 space-y-3 text-body leading-relaxed text-night-muted">
            {s.body.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
