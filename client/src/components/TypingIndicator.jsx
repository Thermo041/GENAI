/** Animated three-dot typing indicator shown while waiting for the first token. */
export default function TypingIndicator() {
  return (
    <div className="chat chat-start animate-fade-in">
      <div className="chat-image avatar placeholder">
        <div className="w-8 rounded-full bg-primary text-primary-content">
          <span className="text-xs font-bold">AI</span>
        </div>
      </div>
      <div className="chat-bubble bg-base-200">
        <span className="loading loading-dots loading-sm" />
      </div>
    </div>
  );
}
