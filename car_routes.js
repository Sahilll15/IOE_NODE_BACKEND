const express = require('express');
const router = express.Router();
const car_controller = require('./car_controller');

router.post('/create', car_controller.createCar);
router.get('/get/:numberPlate', car_controller.getCar);

module.exports = router;

