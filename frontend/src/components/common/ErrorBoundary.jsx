import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Error Boundary Caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>Please refresh the page or try again later.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    padding: "40px",
    textAlign: "center",
    color: "#fff",
    background: "rgba(255, 0, 0, 0.1)",
    borderRadius: "10px",
    marginTop: "20px"
  },
  title: { fontSize: "22px", marginBottom: "10px" },
  message: { fontSize: "16px", opacity: 0.9 }
};

export default ErrorBoundary;
