const FoodizeLogo = ({ size = 32, color }) => {
  const textColor = color || 'currentColor';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '1px',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: size,
          color: textColor,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        food
      </span>
      <span
        style={{
          fontFamily: '"Manrope", -apple-system, sans-serif',
          fontWeight: 800,
          fontSize: size * 0.72,
          color: 'var(--fire, #f59e0b)',
          letterSpacing: '0.02em',
          lineHeight: 1,
          textTransform: 'lowercase',
          alignSelf: 'flex-end',
          marginBottom: size * 0.04,
        }}
      >
        ize
      </span>
    </div>
  );
};

export default FoodizeLogo;
