const car_model = require("../models/car_model");

exports.createCar = async (req, res) => {
    try {
        const { numberPlate } = req.body;
        const existingCar = await car_model.findOne({ numberPlate });

        if (existingCar) {
            // Car exists, calculate time difference
            const inTime = new Date(existingCar.inTime);
            const outTime = new Date();
            const timeDifference = outTime - inTime;

            // Convert time difference to hours and minutes
            const hours = Math.floor(timeDifference / (1000 * 60 * 60));
            const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));

            // Update existing car entry
            existingCar.inTime = null;
            existingCar.outTime = null;
            await existingCar.save();

            res.status(200).json({
                message: "Car exited",
                numberPlate,
                parkingDuration: `${hours} hours and ${minutes} minutes`
            });
        } else {
            // Car doesn't exist, create new entry
            const newCar = await car_model.create({
                ...req.body,
                inTime: new Date()
            });
            res.status(201).json({
                message: "Car entered",
                car: newCar
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.getCar = async (req, res) => {
    try {
        const car = await car_model.findById(req.params.id);
        res.status(200).json(car);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const images=['./car/car1.jpg','./car/ca2.webp','./car/car3.webp','./car/car4.jpg','./car/car6.webp','./car/car7.jpg','./car/car8.jpg']

async function extractNumberPlate(imageURl) {
  try {
    // const file = req.file;
    const imagePath =imageURl;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Please analyze this image and describe any visible vehicle registration information for legitimate purposes, such as parking management or authorized vehicle identification.";

    const imageData = await fs.readFile(imagePath);
    const imageParts = [
      {
        inlineData: {
          data: imageData.toString('base64'),
          mimeType: "image/jpeg"
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const extractedPlate = response.text();

    console.log('Extracted number plate:', extractedPlate);
  } catch (error) {
    console.error('Error processing image:', error);
  }
}


images.forEach(image=>{
  extractNumberPlate(image)
})
