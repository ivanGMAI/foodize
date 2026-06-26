// Recharts components for dashboard analytics
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

const ChartCard = ({ title, children }) => (
  <div
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      padding: '20px',
    }}
  >
    <h3
      style={{
        fontSize: '0.95rem',
        fontWeight: 700,
        margin: '0 0 16px',
        color: 'var(--text-1)',
      }}
    >
      {title}
    </h3>
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

export const RevenueChart = ({ data }) => (
  <ChartCard title="Динамика выручки">
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--fire)" stopOpacity={0.3} />
          <stop offset="95%" stopColor="var(--fire)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="var(--border)"
        vertical={false}
      />
      <XAxis
        dataKey="date"
        stroke="var(--text-3)"
        fontSize={11}
        tickFormatter={(val) =>
          new Date(val).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
          })
        }
      />
      <YAxis
        stroke="var(--text-3)"
        fontSize={11}
        tickFormatter={(val) => `${val}₽`}
      />
      <Tooltip
        contentStyle={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
        labelStyle={{ color: 'var(--text-1)', fontWeight: 700 }}
      />
      <Area
        type="monotone"
        dataKey="value"
        stroke="var(--fire)"
        fillOpacity={1}
        fill="url(#colorRevenue)"
        strokeWidth={2}
        name="Выручка"
      />
    </AreaChart>
  </ChartCard>
);

export const HourlyLoadChart = ({ data }) => (
  <ChartCard title="Нагрузка по часам">
    <BarChart data={data}>
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="var(--border)"
        vertical={false}
      />
      <XAxis dataKey="label" stroke="var(--text-3)" fontSize={11} />
      <YAxis stroke="var(--text-3)" fontSize={11} />
      <Tooltip
        contentStyle={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      />
      <Bar
        dataKey="value"
        fill="var(--fire)"
        radius={[4, 4, 0, 0]}
        name="Заказы"
      />
    </BarChart>
  </ChartCard>
);

export const CategoryRevenueChart = ({ data }) => (
  <ChartCard title="Выручка по категориям">
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={80}
        paddingAngle={5}
        dataKey="value"
        nameKey="label"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      />
      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
    </PieChart>
  </ChartCard>
);

export const AOVDynamicsChart = ({ data }) => (
  <ChartCard title="Динамика среднего чека">
    <LineChart data={data}>
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="var(--border)"
        vertical={false}
      />
      <XAxis
        dataKey="date"
        stroke="var(--text-3)"
        fontSize={11}
        tickFormatter={(val) =>
          new Date(val).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
          })
        }
      />
      <YAxis
        stroke="var(--text-3)"
        fontSize={11}
        tickFormatter={(val) => `${val}₽`}
      />
      <Tooltip
        contentStyle={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke="#10b981"
        strokeWidth={2}
        dot={{ r: 4 }}
        name="Средний чек"
      />
    </LineChart>
  </ChartCard>
);

const ROLE_COLORS = {
  CUSTOMER: '#6366f1',
  STAFF: '#10b981',
  VENDOR: '#f59e0b',
};

export const UsersByRoleChart = ({ data = {} }) => {
  const roles = [
    { key: 'CUSTOMER', name: 'Клиенты' },
    { key: 'STAFF', name: 'Персонал' },
    { key: 'VENDOR', name: 'Вендоры' },
  ];
  const total = roles.reduce((s, r) => s + (data[r.key] || 0), 0) || 1;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
      }}
    >
      {roles.map(({ key, name }) => {
        const value = data[key] || 0;
        const pct = Math.round((value / total) * 100);
        const color = ROLE_COLORS[key];
        return (
          <div
            key={key}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                color,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {pct}% от всех
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const KPICards = ({ finance }) => {
  const cancellationRate =
    finance.total_orders > 0
      ? ((finance.cancelled_orders / finance.total_orders) * 100).toFixed(1)
      : 0;

  const growth = finance.revenue_growth_pct;
  const growthColor =
    growth == null ? 'var(--text-3)' : growth >= 0 ? '#10b981' : '#ef4444';
  const growthLabel =
    growth == null ? '—' : `${growth > 0 ? '+' : ''}${growth}%`;

  const cards = [
    {
      label: 'Выручка',
      value: `${(finance.total_revenue ?? 0).toLocaleString('ru-RU')} ₽`,
      color: 'var(--fire)',
      large: true,
    },
    {
      label: 'Рост',
      value: growthLabel,
      color: growthColor,
      sub: 'vs. прошлый период',
    },
    { label: 'Заказов', value: finance.total_orders },
    { label: 'Средний чек', value: `${finance.average_check} ₽` },
    { label: 'Конверсия', value: `${finance.conversion_percent}%` },
    {
      label: 'Отменено',
      value: finance.cancelled_orders,
      sub: `${cancellationRate}% от всех`,
      color: finance.cancelled_orders > 0 ? '#ef4444' : undefined,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      {cards.map(({ label, value, color, sub, large }) => (
        <div
          key={label}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: large ? '1.55rem' : '1.2rem',
              fontWeight: 800,
              color: color ?? 'var(--text-1)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              {sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const OrderStatusPieChart = ({ data }) => {
  const chartData = Object.entries(data).map(([label, value]) => ({
    label,
    value,
  }));
  return (
    <ChartCard title="Статусы заказов">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          nameKey="label"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
      </PieChart>
    </ChartCard>
  );
};

export const TopItemsChart = ({ data }) => {
  // `data` is finance.top_items array
  return (
    <ChartCard title="Топ 5 блюд">
      <BarChart
        data={data.slice(0, 5)}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          horizontal={false}
        />
        <XAxis type="number" stroke="var(--text-3)" fontSize={11} hide />
        <YAxis
          dataKey="name"
          type="category"
          stroke="var(--text-3)"
          fontSize={10}
          width={150}
          tick={{ fill: 'var(--text-1)', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
          formatter={(value) => [value, 'Продано шт.']}
        />
        <Bar
          dataKey="quantity"
          fill="#10b981"
          radius={[0, 4, 4, 0]}
          barSize={18}
        />
      </BarChart>
    </ChartCard>
  );
};

export const TopRestaurantsChart = ({ data }) => {
  return (
    <ChartCard title="Топ 5 ресторанов">
      <BarChart
        data={data.slice(0, 5)}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          horizontal={false}
        />
        <XAxis type="number" stroke="var(--text-3)" fontSize={11} hide />
        <YAxis
          dataKey="name"
          type="category"
          stroke="var(--text-3)"
          fontSize={10}
          width={150}
          tick={{ fill: 'var(--text-1)', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
          formatter={(value) => [`${value} ₽`, 'Выручка']}
        />
        <Bar
          dataKey="revenue"
          fill="var(--fire)"
          radius={[0, 4, 4, 0]}
          barSize={18}
        />
      </BarChart>
    </ChartCard>
  );
};
