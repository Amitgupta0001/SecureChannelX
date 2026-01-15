/**
 * SecureChannelX - Enhanced Loading Spinner Component
 * Modern, smooth loading animations
 */

import React from "react";
import { motion } from "framer-motion";

export default function LoadingSpinner({ 
  size = "md", 
  variant = "modern", 
  color = "purple",
  text = null,
  fullScreen = false,
  message = null
}) {
  // Size mapping
  const sizes = {
    xs: 20,
    sm: 32,
    md: 48,
    lg: 64,
    xl: 80,
  };

  const sizeValue = sizes[size] || sizes.md;

  /**
   * Modern Spinner - Smooth rotating ring
   */
  const ModernSpinner = () => (
    <div className="relative" style={{ width: sizeValue, height: sizeValue }}>
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-purple-500/20"
        style={{ borderTopColor: '#a855f7', borderRightColor: '#a855f7' }}
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          duration: 1,
          ease: "linear",
        }}
      />
      
      {/* Inner glow */}
      <motion.div
        className="absolute inset-2 rounded-full bg-purple-500/10"
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut",
        }}
      />
    </div>
  );

  /**
   * Dots Spinner - Three bouncing dots
   */
  const DotsSpinner = () => (
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 bg-purple-500 rounded-full"
          animate={{ y: [0, -12, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.6,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );

  /**
   * Pulse Spinner - Pulsing circle
   */
  const PulseSpinner = () => (
    <motion.div
      className="bg-purple-500 rounded-full"
      style={{ width: sizeValue, height: sizeValue }}
      animate={{ 
        scale: [1, 1.3, 1], 
        opacity: [0.6, 1, 0.6] 
      }}
      transition={{
        repeat: Infinity,
        duration: 1.5,
        ease: "easeInOut",
      }}
    />
  );

  /**
   * Orbit Spinner - Orbiting dots
   */
  const OrbitSpinner = () => (
    <div className="relative" style={{ width: sizeValue, height: sizeValue }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 w-3 h-3 bg-purple-500 rounded-full"
          style={{
            marginLeft: -6,
            marginTop: -6,
          }}
          animate={{
            rotate: 360,
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            delay: i * 0.5,
            ease: "linear",
          }}
        >
          <div 
            className="absolute bg-purple-500 rounded-full w-3 h-3"
            style={{
              left: sizeValue / 2 - 6,
            }}
          />
        </motion.div>
      ))}
    </div>
  );

  /**
   * Render selected variant
   */
  const renderSpinner = () => {
    switch (variant) {
      case "dots":
        return <DotsSpinner />;
      case "pulse":
        return <PulseSpinner />;
      case "orbit":
        return <OrbitSpinner />;
      case "modern":
      default:
        return <ModernSpinner />;
    }
  };

  const content = (
    <motion.div 
      className="flex flex-col items-center justify-center gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {renderSpinner()}
      
      {(text || message) && (
        <motion.p 
          className="text-white font-medium text-center max-w-xs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {text || message}
        </motion.p>
      )}
    </motion.div>
  );

  if (fullScreen) {
    return (
      <motion.div 
        className="fixed inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/10 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                repeat: Infinity,
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10">
          {content}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full flex justify-center items-center py-8">
      {content}
    </div>
  );
}
