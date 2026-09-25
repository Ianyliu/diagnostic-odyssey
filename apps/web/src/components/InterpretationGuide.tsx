interface InterpretationGuideProps {
  id: string;
  title?: string;
  whatThisShows: string;
  whyItMatters: string;
  whatItDoesNotShow: string;
  whatToDoNext: string;
}

export function InterpretationGuide({
  id,
  title = "How to interpret this",
  whatThisShows,
  whyItMatters,
  whatItDoesNotShow,
  whatToDoNext
}: InterpretationGuideProps) {
  const titleId = `${id}-title`;

  return <section className="interpretation-guide" aria-labelledby={titleId}>
    <h3 id={titleId}>{title}</h3>
    <dl className="interpretation-guide-list">
      <div>
        <dt>What this shows</dt>
        <dd>{whatThisShows}</dd>
      </div>
      <div>
        <dt>Why it matters</dt>
        <dd>{whyItMatters}</dd>
      </div>
      <div>
        <dt>What it does not show</dt>
        <dd>{whatItDoesNotShow}</dd>
      </div>
      <div>
        <dt>What to do next</dt>
        <dd>{whatToDoNext}</dd>
      </div>
    </dl>
  </section>;
}
