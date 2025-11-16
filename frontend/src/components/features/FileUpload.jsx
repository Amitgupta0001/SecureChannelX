import React, { useState } from "react";
import "../../styles/components/FileUpload.css";


const FileUpload = ({ roomId, onClose, onSend }) => {
  const [file, setFile] = useState(null);

  const handleSelect = (event) => {
    setFile(event.target.files[0]);
  };

  const sendFile = () => {
    if (file) {
      onSend(file);
      setFile(null);
      onClose();
    }
  };

  return (
    <div className="upload-overlay">
      <div className="upload-modal">

        <div className="upload-header">
          <h3>Upload File</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="upload-content">
          <input
            type="file"
            onChange={handleSelect}
            className="file-input"
          />

          {file && (
            <div className="file-preview">
              <p>Selected: <strong>{file.name}</strong></p>
              <button className="upload-btn" onClick={sendFile}>
                Send File
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default FileUpload;
