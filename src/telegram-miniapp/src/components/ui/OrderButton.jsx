import { useState } from "react";
import { Check } from "@phosphor-icons/react";

const OrderButton = ({
  onClick,
  children,
  isLoading,
  isSuccess,
  disabled,
  className = "",
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);
  const handleTouchStart = () => setIsPressed(true);
  const handleTouchEnd = () => setIsPressed(false);

  return (
    <button
      className={`btn btn-primary ${className} ${isLoading ? "loading" : ""} ${isSuccess ? "success" : ""}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: isPressed ? "scale(0.95)" : "scale(1)",
        transition:
          "transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s",
        ...props.style,
      }}
      {...props}
    >
      {isLoading ? (
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="spinner"
            style={{ width: "18px", height: "18px" }}
          ></span>
          Оформление...
        </span>
      ) : isSuccess ? (
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={20} weight="bold" />
          Готово!
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default OrderButton;
