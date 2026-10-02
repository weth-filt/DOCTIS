import pandas as pd
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib

df = pd.read_excel("Data.xlsx")

print("\n====== DANH SÁCH CỘT ======\n")
print(df.columns)

df = df.rename(columns={
    "BMI": "bmi",
    "glucose máu": "glucose",
    "Nhãn": "disease"
})

df["bmi"] = (
    df["bmi"]
    .astype(str)
    .str.replace(",", ".")
    .astype(float)
)

df["glucose"] = pd.to_numeric(
    df["glucose"],
    errors="coerce"
)

df = df.dropna()

X = df[[
    "glucose",
    "bmi"
]]

y = df["disease"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = GaussianNB()

model.fit(X_train, y_train)

pred = model.predict(X_test)

print("\nAccuracy:", accuracy_score(y_test, pred))

joblib.dump(model, "health_model.pkl")

print("\n✅ Model Saved")