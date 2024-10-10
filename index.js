const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const multer = require('multer');
const fs = require('fs').promises;
const gemini_api_key = 'AIzaSyD00e2A6hNtursL-5kq7wOHLW-qrr5c7Nw';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(gemini_api_key);

app.get('/', (req, res) => {
  res.send('This is the backend server for the file uploader!');
});



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

app.post('/upload', upload.single('file'), (req, res) => {
  console.log('file uploaded successfully');
  res.send('File uploaded successfully!');
});

  app.listen(port, () => {

  console.log(`Server is running on port ${port}`);
});


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
