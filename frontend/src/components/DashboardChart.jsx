import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";

export default function DashboardChart({ data }) {

  return (

    <ResponsiveContainer
      width="100%"
      height={350}
    >

      <LineChart data={data}>

        <CartesianGrid
          strokeDasharray="3 3"
        />

        <XAxis
          dataKey="createdAt"
          tickFormatter={(date) =>
            new Date(date)
              .toLocaleDateString("vi-VN")
          }
        />

        <YAxis />

        <Tooltip
          labelFormatter={(date) =>
            new Date(date)
              .toLocaleString("vi-VN")
          }
        />

        <Legend />

        <Line
          type="monotone"
          dataKey="glucose"
          stroke="#00f5ff"
          strokeWidth={3}
          name="Glucose"
        />

        <Line
          type="monotone"
          dataKey="bmi"
          stroke="#8b5cf6"
          strokeWidth={3}
          name="BMI"
        />

        <Line
          type="monotone"
          dataKey="heartRate"
          stroke="#ff4d6d"
          strokeWidth={3}
          name="Nhịp tim"
        />

      </LineChart>

    </ResponsiveContainer>

  );

}