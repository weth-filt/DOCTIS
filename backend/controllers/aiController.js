const { chatAI } = require("../services/aiService");

exports.analyze = async (req, res) => {

  try {

    const result = await chatAI(req.body);

    res.json(result);

  }

  catch (err) {

    console.log(err);

    res.status(500).json({
      message: "AI Error"
    });

  }

};