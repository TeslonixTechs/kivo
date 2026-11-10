import React from "react";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function StudyTerm({ term, meaning }) {
  return (
    <details className="study-term">
      <summary aria-label={`Show definition of ${term}`}>{term}</summary>
      <span className="study-term-popover" role="tooltip">{meaning}</span>
    </details>
  );
}

const renderTerms = (text, definitions) => {
  if (!definitions.length) return text;
  const expression = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${definitions.map(({ term }) => escapeRegex(term)).join("|")})(?=$|[^\\p{L}\\p{N}_])`,
    "giu"
  );
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(expression)) {
    const term = match[2];
    const start = match.index + match[1].length;
    const definition = definitions.find((item) => item.term.toLocaleLowerCase() === term.toLocaleLowerCase());
    if (!definition) continue;
    parts.push(text.slice(lastIndex, start));
    parts.push(<StudyTerm key={`${start}-${term}`} term={term} meaning={definition.meaning} />);
    lastIndex = start + term.length;
  }
  parts.push(text.slice(lastIndex));
  return parts;
};

const renderInline = (text, definitions = []) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={index}>{renderTerms(part.slice(2, -2), definitions)}</strong>;
    }
    return <React.Fragment key={index}>{renderTerms(part, definitions)}</React.Fragment>;
  });
};

export default function StudyNotes({ guide }) {
  const sections = guide.sections || [];
  const definitions = [...(guide.terms || []), ...sections.flatMap((section) => section.keyTerms || [])]
    .map((item) => ({
      term: String(item.term || item.word || "").trim(),
      meaning: String(item.meaning || "").trim(),
    }))
    .filter((item) => item.term && item.meaning)
    .filter((item, index, list) => list.findIndex((entry) => entry.term.toLocaleLowerCase() === item.term.toLocaleLowerCase()) === index)
    .sort((a, b) => b.term.length - a.term.length);
  return (
    <article className="guide-document study-notes">
      <p className="eyebrow">STUDY NOTES FROM YOUR MATERIALS</p>
      <h2>{guide.title}</h2>
      {guide.overview && <p className="guide-intro">{renderInline(guide.overview, definitions)}</p>}

      {sections.map((section, index) => (
        <section className="study-note-section" key={`${section.heading}-${index}`}>
          <div>
            <span className="study-note-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{section.heading}</h3>
            {section.content && <p>{renderInline(section.content, definitions)}</p>}
            {section.points?.length > 0 && (
              <ul>{section.points.map((point, pointIndex) => <li key={pointIndex}>{renderInline(point, definitions)}</li>)}</ul>
            )}
            {section.keyTerms?.length > 0 && (
              <div className="key-terms">
                {section.keyTerms.map((term, termIndex) => (
                  <p key={termIndex}><StudyTerm term={term.term || term.word} meaning={renderInline(term.meaning)} /></p>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {guide.quickRevision?.length > 0 && (
        <div className="quick-revision">
          <p className="eyebrow">QUICK REVISION</p>
          <ul>{guide.quickRevision.map((item, index) => <li key={index}>{renderInline(item, definitions)}</li>)}</ul>
        </div>
      )}
    </article>
  );
}
