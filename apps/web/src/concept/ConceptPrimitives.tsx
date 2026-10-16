import type { ReactNode } from "react";
import { illustrativeLabel } from "./storyboard";

export function ConceptIcon({name, size = 24}: {name: string; size?: number}) {
  const paths: Record<string, ReactNode> = {
    story: <><path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" /><path d="m3 7-1 1v14h14l1-1" /></>,
    research: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M7 10h6M10 7v6" /></>,
    map: <><rect x="2" y="9" width="5" height="6" rx="1"/><rect x="17" y="2" width="5" height="6" rx="1"/><rect x="17" y="16" width="5" height="6" rx="1"/><path d="M7 12h5V5h5M12 12v7h5" /></>,
    compare: <><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M5 8h3m-3 4h3m8-4h3m-3 4h3" /></>,
    spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM20 2v4m-2-2h4"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.story}</svg>;
}
export function RoleLabel({kind = "concept", children}: {kind?: "concept" | "reviewed" | "assumption" | "result"; children?: ReactNode}) {
  return <span className={`fc-role fc-role-${kind}`}><span aria-hidden="true" />{children ?? illustrativeLabel}</span>;
}
export function ConceptCard({title, children, className = "", eyebrow}: {title: string; children: ReactNode; className?: string; eyebrow?: string}) {
  return <article className={`fc-card ${className}`}><RoleLabel />{eyebrow && <p className="fc-kicker">{eyebrow}</p>}<h3>{title}</h3>{children}</article>;
}
export function ViewHeading({eyebrow, title, children}: {eyebrow: string; title: string; children: ReactNode}) {
  return <header className="fc-view-heading"><p className="fc-kicker">{eyebrow}</p><h2>{title}</h2><p>{children}</p></header>;
}
export function QuestionList({questions}: {questions: readonly string[]}) {
  return <ul className="fc-questions">{questions.map(question => <li key={question}><span aria-hidden="true">?</span>{question}</li>)}</ul>;
}
export const transferQuestions = [
  ["Population", "Would eligibility, illness definition and access needs match?"],
  ["Geography & health system", "Would service geography, payer and referral pathways transfer?"],
  ["Delivery & resources", "Would staffing, digital access and delivery conditions be comparable?"],
  ["Outcomes & follow-up", "Would outcome definitions and observation windows be relevant?"]
] as const;
export function TransferabilityQuestions() {
  return <dl className="fc-facts">{transferQuestions.map(([name, question]) => <div key={name}><dt>{name} <span className="fc-unknown">Not evaluated</span></dt><dd>{question}</dd></div>)}</dl>;
}
