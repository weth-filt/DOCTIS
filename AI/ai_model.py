from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

# LOAD MODEL

model = joblib.load("health_model.pkl")

# ================= PREDICT =================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.json

        glucose = float(data["glucose"])
        bmi = float(data["bmi"])

        # MODEL INPUT

        values = [[
            glucose,
            bmi
        ]]

        # AI PREDICT

        prediction = model.predict(values)[0]

        # ================= AI ANALYSIS =================

        recommendation = ""
        risk = "Thấp"

        if glucose > 180:

            risk = "Cao"

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

        else:

            recommendation = """
- Chỉ số hiện ổn định
- Duy trì ăn uống lành mạnh
- Tập thể dục đều đặn
"""

        return jsonify({

            "prediction": str(prediction),

            "riskLevel": risk,

            "recommendation": recommendation

        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        })

# ================= RUN =================

if __name__ == "__main__":

    app.run(
        port=8000,
        debug=True
    )