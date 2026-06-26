const EmptyState = ({ title = "Здесь пусто", subtitle, action }) => {
  return (
    <div className="empty-state page-enter">
      <p className="empty-title">{title}</p>
      {subtitle && <p className="empty-subtitle">{subtitle}</p>}
      {action && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
