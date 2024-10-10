const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const multer = require('multer');
const mongoose = require('mongoose');
require('dotenv').config();


mongoose.connect(process.env.mongoDbURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, 
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Error connecting to MongoDB:', err));

app.use(express.json());

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExtension = file.originalname.split('.').pop();
      cb(null, file.fieldname + '-' + uniqueSuffix + '.' + fileExtension);
    }
  })
});

const carNumberSchema = new mongoose.Schema({
  carNumber: String,
}, {
  timestamps: true
});

const CarNumber = mongoose.model('CarNumber', carNumberSchema);

app.post('/create-car-number', async (req, res) => {
  try {
    console.log('Create car number API called');

    const { carNumber } = req.body;

    if (!carNumber) {
      return res.status(400).json({
        message: 'Car number is required in the request body'
      });
    }

    const existingCar = await CarNumber.findOne({ carNumber });

    if (existingCar) {
      const currentTime = new Date();
      const previousTime = new Date(existingCar.createdAt);
      const durationInMilliseconds = currentTime - previousTime;
      const durationInHours = Math.ceil(durationInMilliseconds / (1000 * 60 * 60)); 
      const cost = durationInHours * 100;

      const deleteCar=await CarNumber.deleteOne({ carNumber });

      return res.status(200).json({
        message: `Car left the parking lot.`,
        duration: `${durationInHours} hour(s)`,
        cost: `Rs. ${cost}`
      });
    } else {
      const newCar = await CarNumber.create({ carNumber });

      return res.status(200).json({
        carNumber: newCar.carNumber,
        message: 'Car number created successfully (Car entered parking lot)'
      });
    }

  } catch (error) {
    console.error('Error in creating car number:', error);
    return res.status(500).json({
      message: 'Error in creating car number',
      error: error.message
    });
  }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }else{

    const file = req.file;


    //add gemini code here 


    let carNumber='xxxx'

    const existingCar = await CarNumber.findOne({ carNumber });

    if (existingCar) {
      const currentTime = new Date();
      const previousTime = new Date(existingCar.createdAt);
      const durationInMilliseconds = currentTime - previousTime;
      const durationInHours = Math.ceil(durationInMilliseconds / (1000 * 60 * 60)); 
      const cost = durationInHours * 100;

      const deleteCar=await CarNumber.deleteOne({ carNumber });

      return res.status(200).json({
        message: `Car left the parking lot.`,
        duration: `${durationInHours} hour(s)`,
        cost: `Rs. ${cost}`
      });
    } else {
      const newCar = await CarNumber.create({ carNumber });

      return res.status(200).json({
        carNumber: newCar.carNumber,
        message: 'Car number created successfully (Car entered parking lot)'
      });
    }

  }
  
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
