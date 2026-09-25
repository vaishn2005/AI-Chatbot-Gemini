import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();

    const message = input.trim();

    if (!message || loading) {
      return;
    }

    // Show user's message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to process your message."
        );
      }

      // Show AI response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.message,
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            error.message ||
            "Sorry, I couldn't process your message.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="chat-container">

        {/* Header */}
        <header className="chat-header">
          <div className="bot-icon">🤖</div>

          <div>
            <h1>AI Chatbot</h1>
            <p>Ask me anything!</p>
          </div>
        </header>

        {/* Chat messages */}
        <main className="chat-messages">

          {messages.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">✨</div>

              <h2>Hello! 👋</h2>

              <p>
                I'm your AI assistant. Ask me anything and
                I'll try my best to help you.
              </p>

              <div className="suggestions">
                <button
                  onClick={() =>
                    setInput("What is Python?")
                  }
                >
                  What is Python?
                </button>

                <button
                  onClick={() =>
                    setInput("Explain Java OOP")
                  }
                >
                  Explain Java OOP
                </button>

                <button
                  onClick={() =>
                    setInput("What is machine learning?")
                  }
                >
                  What is machine learning?
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`message-row ${
                message.role === "user"
                  ? "user-row"
                  : "assistant-row"
              }`}
            >
              <div
                className={`message ${
                  message.role === "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row assistant-row">
              <div className="message assistant-message typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

        </main>

        {/* Input */}
        <form
          className="chat-input-area"
          onSubmit={sendMessage}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
          >
            {loading ? "..." : "Send"}
          </button>
        </form>

        <div className="footer">
          Powered by Gemini AI
        </div>

      </div>
    </div>
  );
}

export default App;