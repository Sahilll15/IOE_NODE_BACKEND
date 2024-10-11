const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
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

      if (existingCar) {
        const currentTime = new Date();
        const previousTime = new Date(existingCar.createdAt);
        const durationInMilliseconds = currentTime - previousTime;
        const durationInHours = Math.ceil(durationInMilliseconds / (1000 * 60 * 60)); 
        const cost = durationInHours * 100;

        await CarNumber.deleteOne({ carNumber });

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