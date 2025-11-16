import React from "react";
import "../../styles/components/Loading.css"; // optional external style

const LoadingSpinner = ({ size = 45 }) => {
  return (
    <div className="loading-spinner-container">
      <div
        className="loading-spinner"
        style={{ width: size, height: size }}
      ></div>
    </div>
  );
};

export default LoadingSpinner;
