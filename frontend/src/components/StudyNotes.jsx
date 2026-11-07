import React from "react";

const renderInline = (text) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

export default function StudyNotes({ guide }) {
  const sections = guide.sections || [];
  return (
    <article className="guide-document study-notes">
      <p className="eyebrow">STUDY NOTES FROM YOUR MATERIALS</p>
      <h2>{guide.title}</h2>
      {guide.overview && <p className="guide-intro">{renderInline(guide.overview)}</p>}

      {sections.map((section, index) => (
        <section className="study-note-section" key={`${section.heading}-${index}`}>
          <div>
            <span className="study-note-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{section.heading}</h3>
            {section.content && <p>{renderInline(section.content)}</p>}
            {section.points?.length > 0 && (
              <ul>{section.points.map((point, pointIndex) => <li key={pointIndex}>{renderInline(point)}</li>)}</ul>
            )}
            {section.keyTerms?.length > 0 && (
              <div className="key-terms">
                {section.keyTerms.map((term, termIndex) => (
                  <p key={termIndex}><strong>{term.term || term.word}</strong> — {renderInline(term.meaning)}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {guide.quickRevision?.length > 0 && (
        <div className="quick-revision">
          <p className="eyebrow">QUICK REVISION</p>
          <ul>{guide.quickRevision.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>
        </div>
      )}
    </article>
  );
}
