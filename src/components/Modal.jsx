import { S } from "../styles.js";

export default function Modal({ children, onClose, smoothEntrance }) {
  return (
    <div style={{
      ...S.modal,
      ...(smoothEntrance ? {
        animation: "modalBgFadeIn 0.5s ease forwards",
        opacity: 0,
      } : {}),
    }} onClick={onClose}>
      <style>{`
        @keyframes modalBgFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        ...S.modalContent,
        ...(smoothEntrance ? {
          animation: "modalSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards",
          opacity: 0,
        } : {}),
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
