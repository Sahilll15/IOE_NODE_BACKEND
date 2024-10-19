const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 4000;
const multer = require('multer');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize AWS S3 and Textract clients
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const textract = new AWS.Textract();

mongoose.connect(process.env.mongoDbURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

app.use(cors());
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
  ownerName: String,
  state: String,
  pincode: String,
  chassisNumber: String,
  engineNumber: String,
  color: String,
  regDate: String,
  vehicleClass: String,
  fuelType: String,
  vehicleManufacturer: String,
  model: String,
  insuranceValidUpto: Date,
  puccValidUpto: Date,
  inTime: Date,
  outTime: Date,
  lastParkingDuration: Number, // in minutes
  cost: Number, // Add this new field
  isParked: { type: Boolean, default: false }, // Add this new field
}, {
  timestamps: true
});

const CarNumber = mongoose.model('CarNumber', carNumberSchema);

// Function to upload file to S3
const uploadFileToS3 = async (filePath, bucketName) => {
  const fileContent = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileContent
  };

  const uploadResult = await s3.upload(params).promise();
  return uploadResult.Location;
};

// Function to extract text from image using Textract
const extractNumberPlateFromS3 = async (bucketName, fileName) => {
  const params = {
    Document: {
      S3Object: {
        Bucket: bucketName,
        Name: fileName
      }
    }
  };

  const response = await textract.detectDocumentText(params).promise();
  const blocks = response.Blocks || [];
  const fullText = blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join(' ');

  const numberPlateRegex = /[A-Z]{2}\s?[0-9]{1,2}[A-Z]{0,2}\s?[0-9]{4}/;
  const match = fullText.match(numberPlateRegex);

  if (match) {
    return match[0];
  } else {
    throw new Error('No valid number plate found.');
  }
};

// Function to get vehicle details (simulate API call)
async function getVehicleDetails(carNumber) {
  const url = 'https://rto-vehicle-information-verification-india.p.rapidapi.com/api/v1/rc/vehicleinfo';
  const options = {
    method: 'POST',
    headers: {
      'x-rapidapi-key': 'e320c6f594msh4c473664bcbd8b7p112369jsn899a67eb94f5',
      'x-rapidapi-host': 'rto-vehicle-information-verification-india.p.rapidapi.com',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reg_no: carNumber,
      consent: 'Y',
      consent_text: 'I hear by declare my consent agreement for fetching my information via AITAN Labs API'
    })
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    console.log(result);
    return result.result;
  } catch (error) {
    console.error('Error fetching vehicle details:', error);
    throw error;
  }
}

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  } else {
    const file = req.file;
    const bucketName = 'aws-notes-sahil';

    try {
      // Upload the file to S3
      const s3FileUrl = await uploadFileToS3(file.path, bucketName);
      const s3FileName = path.basename(s3FileUrl);

      // Extract the number plate from the uploaded S3 file
      const carNumber = await extractNumberPlateFromS3(bucketName, s3FileName);

      const existingCar = await CarNumber.findOne({ carNumber });
      const currentTime = new Date();

      if (existingCar) {
        if (existingCar.outTime) {
          // Car is re-entering, update inTime, clear outTime, and set isParked to true
          existingCar.inTime = currentTime;
          existingCar.outTime = null;
          existingCar.cost = null; // Reset cost when re-entering
          existingCar.isParked = true; // Set isParked to true
          await existingCar.save();

          return res.status(200).json({
            message: `Car re-entered the parking lot.`,
            carNumber: existingCar.carNumber,
            inTime: existingCar.inTime
          });
        } else {
          // Car is leaving
          existingCar.outTime = currentTime;
          existingCar.isParked = false; // Set isParked to false
          const durationInMilliseconds = existingCar.outTime - existingCar.inTime;
          const durationInMinutes = Math.ceil(durationInMilliseconds / (1000 * 60));
          const cost = Math.ceil(durationInMinutes / 60) * 10; // Changed from 100 Rs per hour to 10 Rs per hour

          existingCar.lastParkingDuration = durationInMinutes;
          existingCar.cost = cost; // Store the calculated cost
          await existingCar.save();

          return res.status(200).json({
            message: `Car left the parking lot.`,
            carNumber: existingCar.carNumber,
            duration: `${durationInMinutes} minute(s)`,
            cost: `Rs. ${cost}`
          });
        }
      } else {
        let vehicleDetails = {};
        try {
          const apiResponse = await getVehicleDetails(carNumber);
          if (apiResponse && apiResponse.status_code === 200) {
            vehicleDetails = apiResponse.result;
          } else {
            console.error('Vehicle details API returned an error:', apiResponse);
          }
        } catch (error) {
          console.error('Error fetching vehicle details:', error);
        }

        const newCar = await CarNumber.create({
          carNumber: carNumber,
          inTime: currentTime,
          cost: null,
          ownerName: vehicleDetails.owner_name || '',
          state: vehicleDetails.state || '',
          pincode: vehicleDetails.pincode || '',
          chassisNumber: vehicleDetails.chassis_number || '',
          engineNumber: vehicleDetails.engine_number || '',
          color: vehicleDetails.color || '',
          vehicleClass: vehicleDetails.vehicle_class_desc || '',
          fuelType: vehicleDetails.fuel_descr || '',
          vehicleManufacturer: vehicleDetails.vehicle_manufacturer_name || '',
          model: vehicleDetails.model || '',
          isParked: true // Set isParked to true for new entries
        });

        return res.status(200).json({
          carNumber: newCar.carNumber,
          message: 'Car entered parking lot',
          inTime: newCar.inTime
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      return res.status(500).json({
        message: 'Error processing image',
        error: error.message
      });
    } finally {
      // Clean up: delete the uploaded file
      fs.unlink(file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Parking Management System</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                max-width: 800px;
                margin: auto;
                padding: 20px;
                background-color: #fff;
                border-radius: 5px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            h1 {
                color: #333;
                text-align: center;
            }
            p {
                color: #666;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Parking Management System</h1>
            <p>Welcome to our automated parking management system.</p>
            <p>This system uses image recognition to manage vehicle entry and exit.</p>
        </div>
    </body>
    </html>
  `);
});

// Add this new GET endpoint after the existing endpoints
app.get('/car/:carNumber', async (req, res) => {
  try {
    const carNumber = req.params.carNumber;
    const car = await CarNumber.findOne({ carNumber });

    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    return res.status(200).json(car);
  } catch (error) {
    console.error('Error fetching car details:', error);
    return res.status(500).json({
      message: 'Error fetching car details',
      error: error.message
    });
  }
});

// Add this new GET endpoint after the existing endpoints
app.get('/cars', async (req, res) => {
  try {
    const cars = await CarNumber.find({});
    return res.status(200).json(cars);
  } catch (error) {
    console.error('Error fetching all car details:', error);
    return res.status(500).json({
      message: 'Error fetching all car details',
      error: error.message
    });
  }
});
