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

