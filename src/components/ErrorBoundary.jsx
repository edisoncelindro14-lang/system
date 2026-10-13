import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", fontFamily: "monospace", color: "#dc2626" }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
