interface InterpretationGuideProps {
  id: string;
  title?: string;
  headingLevel?: 2 | 3;
  whatThisShows: string;
  whyItMatters: string;
  whatItDoesNotShow: string;
  whatToDoNext: string;
}

export function InterpretationGuide({
  id,
  title = "How to interpret this",
  headingLevel = 3,
  whatThisShows,
  whyItMatters,
  whatItDoesNotShow,
  whatToDoNext
}: InterpretationGuideProps) {
  const titleId = `${id}-title`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return <section className="interpretation-guide" aria-labelledby={titleId}>
    <Heading id={titleId}>{title}</Heading>
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
