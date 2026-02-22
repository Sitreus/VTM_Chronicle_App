import { S } from "../styles.js";

export default function EmptyState({ text }) {
  return <div style={S.emptyState}>{text}</div>;
}
