import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "40vh",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "var(--text-1)",
            }}
          >
            Что-то пошло не так
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--text-3)",
              maxWidth: 320,
            }}
          >
            {this.state.error?.message ?? "Неизвестная ошибка"}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
