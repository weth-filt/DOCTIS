module.exports = ({
  glucose,
  bmi
}) => {

  let level = "low";
  let recommendation =
    "Health condition stable.";

  if (
    glucose >= 126 ||
    bmi >= 30
  ) {

    level = "high";

    recommendation =
      "High diabetes risk. Medical check recommended.";

  }

  else if (
    glucose >= 100 ||
    bmi >= 25
  ) {

    level = "medium";

    recommendation =
      "Need better diet and exercise.";

  }

  return {
    level,
    recommendation
  };

};