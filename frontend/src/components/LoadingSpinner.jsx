// FILE: src/components/LoadingSpinner.jsx
import React from "react";
import { motion } from "framer-motion";

export default function LoadingSpinner({ size = 45 }) {
  return (
    <div className="w-full flex justify-center items-center py-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          duration: 0.8,
          ease: "linear",
        }}
        className="border-4 border-transparent border-t-blue-500 rounded-full"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
