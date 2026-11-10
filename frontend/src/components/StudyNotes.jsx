import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function StudyTerm({ term, meaning }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const popupRef = useRef(null);
  const popupId = useId();

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      if (!buttonRef.current || !popupRef.current) return;
      const anchor = buttonRef.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      popupRef.current.style.maxWidth = `${Math.max(0, viewportWidth - 24)}px`;
      const popup = popupRef.current.getBoundingClientRect();
      const padding = 12;
      const left = Math.min(
        Math.max(padding, anchor.left),
        Math.max(padding, viewportWidth - popup.width - padding)
      );
      const below = anchor.bottom + 8;
      const top = below + popup.height <= viewportHeight - padding
        ? below
        : Math.max(padding, anchor.top - popup.height - 8);
      setPosition({ top, left });
    };
    const closeOnOutsideClick = (event) => {
      if (!buttonRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="study-term-trigger"
        aria-label={`Show definition of ${term}`}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((value) => !value)}
      >{term}</button>
      {open && createPortal(
        <span
          ref={popupRef}
          id={popupId}
          className="study-term-popover"
          role="tooltip"
          style={{ top: position.top, left: position.left }}
        >{meaning}</span>,
        document.body
      )}
    </>
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
