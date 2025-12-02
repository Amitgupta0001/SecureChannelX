/**
 * ✅ ENHANCED: SecureChannelX - Loading Spinner Component
 * -------------------------------------------------------
 * Reusable loading spinner with variants
 * 
 * Changes:
 *   - Added: Multiple spinner variants
 *   - Added: Size variants
 *   - Added: Color variants
 *   - Added: Optional text label
 */

import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ 
  size = "md", 
  variant = "border", 
  color = "purple",
  text = null,
  fullScreen = false 
}) {
  // Size mapping
  const sizes = {
    xs: 16,
    sm: 24,
    md: 40,
    lg: 56,
    xl: 72,
  };

  const sizeValue = sizes[size] || sizes.md;

  // Color mapping
  const colors = {
    purple: "border-purple-500",
    blue: "border-blue-500",
    green: "border-green-500",
    red: "border-red-500",
    yellow: "border-yellow-500",
  };

  const colorClass = colors[color] || colors.purple;

  /**
   * ✅ VARIANT: Border spinner (default)
   */
  const BorderSpinner = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{
        repeat: Infinity,
        duration: 0.8,
        ease: "linear",
      }}
      className={`border-4 border-transparent ${colorClass} rounded-full`}
      style={{ width: sizeValue, height: sizeValue }}
    />
  );

  /**
   * ✅ VARIANT: Dots spinner
   */
  const DotsSpinner = () => (
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -10, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.6,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
          className={`w-3 h-3 ${colorClass.replace("border-", "bg-")} rounded-full`}
        />
      ))}
    </div>
  );

  /**
   * ✅ VARIANT: Pulse spinner
   */
  const PulseSpinner = () => (
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
      transition={{
        repeat: Infinity,
        duration: 1.5,
        ease: "easeInOut",
      }}
      className={`${colorClass.replace("border-", "bg-")} rounded-full`}
      style={{ width: sizeValue, height: sizeValue }}
    />
  );

  /**
   * ✅ VARIANT: Icon spinner (Loader2)
   */
  const IconSpinner = () => (
    <Loader2
      className={`animate-spin ${colorClass.replace("border-", "text-")}`}
      style={{ width: sizeValue, height: sizeValue }}
    />
  );

  /**
   * ✅ Render selected variant
   */
  const renderSpinner = () => {
    switch (variant) {
      case "dots":
        return <DotsSpinner />;
      case "pulse":
        return <PulseSpinner />;
      case "icon":
        return <IconSpinner />;
      default:
        return <BorderSpinner />;
    }
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {renderSpinner()}
      {text && (
        <p className={`text-sm ${colorClass.replace("border-", "text-")} font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return <div className="w-full flex justify-center items-center py-6">{content}</div>;
}
