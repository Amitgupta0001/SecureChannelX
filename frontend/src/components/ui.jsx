// src/components/ui.jsx
import React from "react";
import clsx from "clsx"; 

/* ===========================
      BUTTON COMPONENT
=========================== */
export const Button = ({ className = "", children, ...props }) => {
  return (
    <button
      className={clsx(
        "px-4 py-2 rounded-md bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

/* ===========================
      INPUT COMPONENT
=========================== */
export const Input = ({ className = "", ...props }) => {
  return (
    <input
      className={clsx(
        "w-full border rounded-md px-3 py-2 text-sm bg-background",
        "focus:outline-none focus:ring-2 focus:ring-primary",
        className
      )}
      {...props}
    />
  );
};

/* ===========================
      LABEL COMPONENT
=========================== */
export const Label = ({ className = "", children, ...props }) => (
  <label
    className={clsx("text-sm font-medium text-foreground", className)}
    {...props}
  >
    {children}
  </label>
);

/* ===========================
        CARD COMPONENT
=========================== */
export const Card = ({ className = "", children }) => (
  <div
    className={clsx(
      "rounded-xl border shadow-sm bg-card text-card-foreground",
      className
    )}
  >
    {children}
  </div>
);

export const CardHeader = ({ className = "", children }) => (
  <div className={clsx("p-6 pb-4", className)}>{children}</div>
);

export const CardTitle = ({ className = "", children }) => (
  <h2 className={clsx("text-xl font-bold", className)}>{children}</h2>
);

export const CardDescription = ({ className = "", children }) => (
  <p className={clsx("text-sm text-muted-foreground", className)}>{children}</p>
);

export const CardContent = ({ className = "", children }) => (
  <div className={clsx("p-6 pt-0", className)}>{children}</div>
);

export const CardFooter = ({ className = "", children }) => (
  <div className={clsx("p-6 pt-0 flex items-center", className)}>
    {children}
  </div>
);

/* ===========================
        ALERT COMPONENT
=========================== */
export const Alert = ({ className = "", children, variant }) => {
  const styles =
    variant === "destructive"
      ? "border-red-500 bg-red-50 text-red-700"
      : "border-border bg-muted text-muted-foreground";

  return (
    <div
      className={clsx(
        "w-full border rounded-md p-3 flex gap-2 items-center",
        styles,
        className
      )}
    >
      {children}
    </div>
  );
};

export const AlertDescription = ({ children }) => (
  <p className="text-sm">{children}</p>
);

/* ===========================
       CHECKBOX COMPONENT
=========================== */
export const Checkbox = ({ checked, onCheckedChange }) => (
  <input
    type="checkbox"
    className="w-4 h-4 rounded border"
    checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
  />
);

/* ===========================
       PROGRESS COMPONENT
=========================== */
export const Progress = ({ value = 0, className = "" }) => (
  <div className={clsx("w-full bg-gray-200 rounded-full h-2", className)}>
    <div
      className="h-full rounded-full transition-all"
      style={{
        width: `${value}%`,
        backgroundColor:
          value < 40
            ? "red"
            : value < 60
            ? "orange"
            : value < 80
            ? "yellow"
            : "green",
      }}
    ></div>
  </div>
);
