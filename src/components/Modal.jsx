import { S } from "../styles.js";

export default function Modal({ children, onClose }) {
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
