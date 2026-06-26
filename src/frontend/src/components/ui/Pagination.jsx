const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 32,
        padding: '16px 0',
      }}
    >
      {page > 1 && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          style={{ borderRadius: '100px', padding: '8px 20px' }}
        >
          ← Назад
        </button>
      )}

      <span
        style={{
          fontSize: '0.85rem',
          fontWeight: 800,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          minWidth: 100,
          textAlign: 'center',
        }}
      >
        {page} / {totalPages}
      </span>

      {page < totalPages && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          style={{ borderRadius: '100px', padding: '8px 20px' }}
        >
          Вперед →
        </button>
      )}
    </div>
  );
};

export default Pagination;
