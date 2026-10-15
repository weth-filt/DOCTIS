import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// Custom Tooltip component with clean clinical styling
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const formattedDate = label
      ? new Date(label).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DFE7ED",
          borderRadius: "12px",
          padding: "12px 16px",
          boxShadow: "0 8px 24px rgba(23, 50, 72, 0.08)",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "#173248",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: "8px",
            color: "#647887",
            borderBottom: "1px solid #EDF2F6",
            paddingBottom: "4px",
          }}
        >
          {formattedDate}
        </div>
        {payload.map((entry, index) => {
          let unit = "";
          if (entry.dataKey === "glucose") unit = " mg/dL";
          else if (entry.dataKey === "bmi") unit = " kg/m²";
          else if (entry.dataKey === "heartRate") unit = " bpm";

          return (
            <div
              key={`item-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "18px",
                margin: "4px 0",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#647887",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: entry.color,
                  }}
                />
                {entry.name}:
              </span>
              <strong style={{ color: "#173248", fontVariantNumeric: "tabular-nums" }}>
                {entry.value}
                <span style={{ fontSize: "11px", fontWeight: "normal", color: "#8E9CA8" }}>
                  {unit}
                </span>
              </strong>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function DashboardChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: 320,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8FAFC",
          borderRadius: "16px",
          border: "1px dashed #DFE7ED",
          color: "#647887",
          fontSize: "14px",
          padding: "20px",
        }}
      >
        <span style={{ fontSize: "32px", marginBottom: "8px" }}>📈</span>
        <strong style={{ color: "#173248" }}>Chưa có dữ liệu lịch sử đo</strong>
        <p style={{ fontSize: "13px", marginTop: "4px" }}>
          Hãy cập nhật các chỉ số sức khỏe của bạn để xem biểu đồ diễn tiến.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 340, marginTop: "12px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F6" vertical={false} />

          <XAxis
            dataKey="createdAt"
            stroke="#8E9CA8"
            tickLine={false}
            tick={{ fill: "#647887", fontSize: 12 }}
            tickFormatter={(date) => {
              if (!date) return "";
              const d = new Date(date);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
          />

          <YAxis
            stroke="#8E9CA8"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#647887", fontSize: 12 }}
          />

          <Tooltip content={<CustomChartTooltip />} />

          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: "14px" }}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: "#173248", fontSize: "13px", fontWeight: 500 }}>
                {value}
              </span>
            )}
          />

          <Line
            type="monotone"
            dataKey="glucose"
            stroke="#087F8C"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#087F8C", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#087F8C", stroke: "#FFFFFF", strokeWidth: 2 }}
            name="Glucose"
          />

          <Line
            type="monotone"
            dataKey="bmi"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#3B82F6", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#3B82F6", stroke: "#FFFFFF", strokeWidth: 2 }}
            name="BMI"
          />

          <Line
            type="monotone"
            dataKey="heartRate"
            stroke="#E53E3E"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#E53E3E", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#E53E3E", stroke: "#FFFFFF", strokeWidth: 2 }}
            name="Nhịp tim"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}