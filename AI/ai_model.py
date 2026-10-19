from flask import Flask, request, jsonify
import joblib
import math
from pathlib import Path
from monitoring_rules import assess, RULES

app = Flask(__name__)

# LOAD MODEL

model = joblib.load(Path(__file__).with_name("health_model.pkl"))

# ================= PREDICT =================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.json

        glucose = float(data["glucose"])
        bmi = float(data["bmi"])
        if not math.isfinite(glucose) or not math.isfinite(bmi) or glucose <= 0 or bmi <= 0:
            return jsonify({"error": "Glucose và BMI phải là số dương hợp lệ."}), 400

        # MODEL INPUT

        values = [[
            glucose,
            bmi
        ]]

        # AI PREDICT

        prediction = model.predict(values)[0]

        # ================= AI ANALYSIS =================

        recommendation = ""
        risk = "Ổn định"

        if glucose > 180 or bmi >= 30:

            risk = "Nguy hiểm"

            recommendation = """
- Đường huyết đang cao
- Giảm đồ ngọt và tinh bột
- Đi bộ 30 phút mỗi ngày
- Uống nhiều nước
- Theo dõi glucose thường xuyên
"""

        elif glucose < 70:

            risk = "Nguy hiểm"

            recommendation = """
- Đường huyết quá thấp
- Uống sữa hoặc ăn bánh ngọt
- Nghỉ ngơi ngay
- Kiểm tra lại glucose
"""

        elif glucose > 126 or bmi >= 25:

            risk = "Cao"

            recommendation = """
- Một số chỉ số cao hơn ngưỡng theo dõi
- Trao đổi với nhân viên y tế để được đánh giá phù hợp
- Theo dõi lại các chỉ số theo hướng dẫn
"""

        else:

            recommendation = """
- Chỉ số hiện ổn định
- Duy trì ăn uống lành mạnh
- Tập thể dục đều đặn
"""

        # Shared monitoring rules are independent of the trained model's label.
        risk = assess(data)
        return jsonify({

            "prediction": str(prediction),

            "riskLevel": risk,
            "riskSource": "monitoring-rule",
            "monitoringRuleVersion": RULES["version"],
            "predictionSource": "gaussian-naive-bayes",

            "recommendation": recommendation

        })

    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Cần glucose và BMI hợp lệ để dự đoán."}), 400

    except Exception:

        return jsonify({
            "error": "Không thể chạy mô hình dự đoán."
        }), 503

# ================= RUN =================

if __name__ == "__main__":

    app.run(
        port=8000,
        debug=False
    )
