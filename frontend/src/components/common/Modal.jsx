import React from "react";
import "../../styles/components/Modal.css";

const Modal = ({ children, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <button className="modal-close" onClick={onClose}>
          ✖
        </button>

        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
